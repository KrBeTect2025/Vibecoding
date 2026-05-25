import json
import time
import sys
import os
import openai
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .services import start_execution, active_sessions
from .models import CheatsheetItem

def get_cheatsheet_data(request):
    items = CheatsheetItem.objects.all().order_by('category', 'name')
    data = {}
    for item in items:
        if item.category not in data:
            data[item.category] = []
        data[item.category].append({
            'name': item.name,
            'description': item.description,
            'syntax': item.syntax,
            'code_example': item.code_example,
            'documentation_url': item.documentation_url
        })
    return JsonResponse(data)


@csrf_exempt
@require_POST
def execute_code_view(request):
    try:
        data = json.loads(request.body)
        code = data.get('code', '')
        session_id = data.get('session_id', f'session_{int(time.time() * 1000)}')
        
        success, error = start_execution(code, session_id)
        if not success:
            return JsonResponse({
                'success': False,
                'error': error
            })

        # Wait a brief moment to see if execution completes quickly or needs input
        time.sleep(0.1)
        
        if session_id in active_sessions:
            session = active_sessions[session_id]
            
            if session['needs_input']:
                return JsonResponse({
                    'success': True,
                    'needs_input': True,
                    'input_prompt': session['input_prompt'],
                    'session_id': session_id,
                    'output': session['output']
                })
            elif session['status'] in ['completed', 'error']:
                # Execution completed quickly
                result = {
                    'success': session['status'] == 'completed',
                    'output': session['output'] if session['output'] else ('Code executed successfully (no output)' if session['status'] == 'completed' else None),
                    'session_id': session_id
                }
                if session['errors']:
                    result['success'] = False
                    result['error'] = session['errors']
                
                # Clean up session
                del active_sessions[session_id]
                return JsonResponse(result)
            else:
                # Still running
                return JsonResponse({
                    'success': True,
                    'running': True,
                    'session_id': session_id,
                    'output': session['output']
                })
        
        return JsonResponse({
            'success': False,
            'error': 'Session lost'
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f"Server Error: {str(e)}"
        })

@csrf_exempt
@require_POST
def provide_input_view(request):
    try:
        data = json.loads(request.body)
        session_id = data.get('session_id', '')
        user_input = data.get('input', '')
        
        if session_id not in active_sessions:
            return JsonResponse({
                'success': False,
                'error': 'Invalid session ID'
            })
        
        session = active_sessions[session_id]
        
        # Find the interactive input handler and provide the input
        if session['thread'] and session['thread'].is_alive():
            # We need to get the interactive input object from the thread
            # Iterate through all frames to find the input handler
            for thread_id, frame in sys._current_frames().items():
                if thread_id == session['thread'].ident:
                    # Look for the interactive_input object in the call stack
                    current_frame = frame
                    while current_frame:
                        if 'interactive_input' in current_frame.f_locals:
                            interactive_input = current_frame.f_locals['interactive_input']
                            if hasattr(interactive_input, 'input_queue'):
                                interactive_input.input_queue.put(user_input)
                                return JsonResponse({
                                    'success': True,
                                    'message': 'Input provided'
                                })
                        current_frame = current_frame.f_back
        
        return JsonResponse({
            'success': False,
            'error': 'Could not deliver input to execution thread'
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f"Input Error: {str(e)}"
        })

@csrf_exempt
@require_POST
def check_status_view(request):
    try:
        data = json.loads(request.body)
        session_id = data.get('session_id', '')
        
        if session_id not in active_sessions:
            return JsonResponse({
                'success': False,
                'error': 'Invalid session ID'
            })
        
        session = active_sessions[session_id]
        
        if session['needs_input']:
            return JsonResponse({
                'success': True,
                'needs_input': True,
                'input_prompt': session['input_prompt'],
                'output': session['output']
            })
        elif session['status'] in ['completed', 'error']:
            result = {
                'success': session['status'] == 'completed',
                'output': session['output'] if session['output'] else ('Code executed successfully (no output)' if session['status'] == 'completed' else None),
                'completed': True
            }
            if session['errors']:
                result['success'] = False
                result['error'] = session['errors']
            
            # Clean up session
            del active_sessions[session_id]
            return JsonResponse(result)
        else:
            return JsonResponse({
                'success': True,
                'running': True,
                'output': session['output']
            })
            
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f"Status Check Error: {str(e)}"
        })

@csrf_exempt
@require_POST
def chat_view(request):
    try:
        data = json.loads(request.body)
        user_message = data.get('message', '')
        
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return JsonResponse({
                'success': False,
                'error': 'OpenAI API key not found. Please set OPENAI_API_KEY environment variable.'
            })

        if not user_message.strip():
            return JsonResponse({
                'success': False,
                'error': 'No message provided'
            })

        client = openai.OpenAI(api_key=api_key)
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": user_message}],
            max_tokens=500,
            temperature=0.7
        )

        reply = response.choices[0].message.content
        return JsonResponse({'success': True, 'reply': reply})

    except Exception as e:
        return JsonResponse({'success': False, 'error': f"Chat Error: {str(e)}"})

@csrf_exempt
@require_POST
def lint_code_view(request):
    try:
        data = json.loads(request.body)
        code = data.get('code', '')
        
        errors = []
        
        # 1. Check for Syntax Errors first (using ast)
        try:
            import ast
            ast.parse(code)
        except SyntaxError as e:
            return JsonResponse({
                'success': True,
                'errors': [{
                    'line': e.lineno,
                    'column': e.offset,
                    'message': f"Syntax Error: {e.msg}",
                    'text': e.text
                }]
            })

        # 2. Check for Static Analysis Errors (using pyflakes)
        try:
            from pyflakes.api import check
            from pyflakes.reporter import Reporter
            import io
            import builtins
            import difflib
            
            # Capture pyflakes output
            warning_stream = io.StringIO()
            error_stream = io.StringIO()
            reporter = Reporter(warning_stream, error_stream)
            
            check(code, 'input', reporter)
            
            # Parse output
            output = warning_stream.getvalue() + error_stream.getvalue()
            code_lines = code.splitlines()
            
            for line in output.splitlines():
                # Format: input:line:col: message
                parts = line.split(':')
                if len(parts) >= 4:
                    lineno = int(parts[1])
                    # col = int(parts[2]) # Pyflakes doesn't always give reliable columns
                    message = ':'.join(parts[3:]).strip()
                    
                    suggestion = ""
                    start_col = 1
                    end_col = 100
                    
                    # Get the actual line of code
                    if 0 <= lineno - 1 < len(code_lines):
                        code_line = code_lines[lineno - 1]
                        end_col = len(code_line) + 1
                    else:
                        code_line = ""

                    # Check for undefined names to offer suggestions and precise highlighting
                    if "undefined name" in message:
                        # Extract the name
                        import re
                        match = re.search(r"undefined name '([^']+)'", message)
                        if match:
                            undefined_name = match.group(1)
                            # Get all builtins + common keywords
                            candidates = dir(builtins) + ['def', 'class', 'import', 'from', 'return', 'print']
                            
                            # Find close matches
                            matches = difflib.get_close_matches(undefined_name, candidates, n=1, cutoff=0.6)
                            if matches:
                                suggestion = f" Did you mean '{matches[0]}'?"
                            
                            # Find position of the name in the line
                            # This is a simple heuristic; might be wrong if name appears multiple times
                            # but better than highlighting the whole line
                            idx = code_line.find(undefined_name)
                            if idx != -1:
                                start_col = idx + 1
                                end_col = idx + 1 + len(undefined_name)
                    
                    errors.append({
                        'line': lineno,
                        'column': start_col,
                        'endColumn': end_col,
                        'message': f"{message}{suggestion}",
                        'text': '' 
                    })
                    
        except Exception as e:
            print(f"Pyflakes error: {e}")
            # Fallback if pyflakes fails
            pass
            
        return JsonResponse({'success': True, 'errors': errors})
            
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})
