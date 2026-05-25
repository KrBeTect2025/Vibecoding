import sys
import io
import contextlib
import traceback
import threading
import queue
import time
import html

# Global dictionary to store active execution sessions
active_sessions = {}

class InteractiveInput:
    def __init__(self, session_id):
        self.session_id = session_id
        self.input_queue = queue.Queue()
        self.waiting_for_input = False
        self.input_prompt = ""
    
    def __call__(self, prompt=""):
        self.input_prompt = prompt
        self.waiting_for_input = True
        
        # Put the input request in the session
        if self.session_id in active_sessions:
            active_sessions[self.session_id]['needs_input'] = True
            active_sessions[self.session_id]['input_prompt'] = prompt
        
        # Wait for input with timeout
        try:
            user_input = self.input_queue.get(timeout=30)  # 30 second timeout
            self.waiting_for_input = False
            if self.session_id in active_sessions:
                active_sessions[self.session_id]['needs_input'] = False
            return user_input
        except queue.Empty:
            self.waiting_for_input = False
            if self.session_id in active_sessions:
                active_sessions[self.session_id]['needs_input'] = False
            raise KeyboardInterrupt("Input timeout - execution stopped")

def execute_code_thread(code, session_id):
    """Execute code in a separate thread"""
    try:
        # Increase recursion limit for complex algorithms
        sys.setrecursionlimit(10000)
        
        # Create string buffer to capture output
        output_buffer = io.StringIO()
        error_buffer = io.StringIO()
        
        # Create interactive input handler
        interactive_input = InteractiveInput(session_id)
        
        # Create a custom print function that writes to our buffer
        def custom_print(*args, sep=' ', end='\n', file=None, flush=False):
            output = sep.join(str(arg) for arg in args) + end
            output_buffer.write(output)
            if flush:
                output_buffer.flush()
        
        # Create a single namespace for both globals and locals
        exec_namespace = {
            '__builtins__': __builtins__,
            'print': custom_print,  # Use our custom print
            'len': len,
            'range': range,
            'str': str,
            'int': int,
            'float': float,
            'list': list,
            'dict': dict,
            'tuple': tuple,
            'set': set,
            'abs': abs,
            'min': min,
            'max': max,
            'sum': sum,
            'sorted': sorted,
            'reversed': reversed,
            'enumerate': enumerate,
            'zip': zip,
            'map': map,
            'filter': filter,
            'type': type,
            'isinstance': isinstance,
            'hasattr': hasattr,
            'getattr': getattr,
            'setattr': setattr,
            'dir': dir,
            'vars': vars,
            'globals': globals,
            'locals': locals,
            'round': round,
            'pow': pow,
            'divmod': divmod,
            'bin': bin,
            'hex': hex,
            'oct': oct,
            'ord': ord,
            'chr': chr,
            'bool': bool,
            'bytes': bytes,
            'bytearray': bytearray,
            'memoryview': memoryview,
            'complex': complex,
            'frozenset': frozenset,
            'slice': slice,
            'super': super,
            'property': property,
            'staticmethod': staticmethod,
            'classmethod': classmethod,
            'all': all,
            'any': any,
            'ascii': ascii,
            'callable': callable,
            'compile': compile,
            'delattr': delattr,
            'eval': eval,
            'format': format,
            'hash': hash,
            'help': help,
            'id': id,
            'input': interactive_input,  # Replace input with our interactive version
            'iter': iter,
            'next': next,
            'object': object,
            'open': open,
            'repr': repr,
            '__import__': __import__,
        }

        # Redirect both stdout and stderr to capture all output
        with contextlib.redirect_stdout(output_buffer), \
             contextlib.redirect_stderr(error_buffer):
            try:
                # Compile the code first to catch syntax errors
                compiled_code = compile(code, '', 'exec')
                # Execute using the same namespace for both globals and locals
                exec(compiled_code, exec_namespace, exec_namespace)
                
                # Mark execution as completed
                output_content = output_buffer.getvalue()
                error_content = error_buffer.getvalue()
                
                # Debug: Print what we captured
                print(f"DEBUG: Output length: {len(output_content)}")
                print(f"DEBUG: Output content: {repr(output_content)}")
                
                if session_id in active_sessions:
                    active_sessions[session_id]['status'] = 'completed'
                    active_sessions[session_id]['output'] = output_content
                    active_sessions[session_id]['errors'] = error_content
                
            except Exception as exec_error:
                # Capture the full traceback
                error_buffer.write(f"Execution Error: {str(exec_error)}\n")
                error_buffer.write(traceback.format_exc())
                
                # Mark execution as completed with error
                if session_id in active_sessions:
                    active_sessions[session_id]['status'] = 'error'
                    active_sessions[session_id]['output'] = output_buffer.getvalue()
                    active_sessions[session_id]['errors'] = error_buffer.getvalue()

    except Exception as e:
        # Mark execution as completed with error
        if session_id in active_sessions:
            active_sessions[session_id]['status'] = 'error'
            active_sessions[session_id]['output'] = ''
            active_sessions[session_id]['errors'] = f"Thread Error: {str(e)}\n{traceback.format_exc()}"

def start_execution(code, session_id):
    """Start execution in a separate thread"""
    # Clean the code
    code = html.unescape(code)
    code = code.strip()
    
    if not code:
        return False, "No code provided"

    # Initialize session
    active_sessions[session_id] = {
        'status': 'running',
        'needs_input': False,
        'input_prompt': '',
        'output': '',
        'errors': '',
        'thread': None
    }

    # Start execution in a separate thread
    execution_thread = threading.Thread(target=execute_code_thread, args=(code, session_id))
    active_sessions[session_id]['thread'] = execution_thread
    execution_thread.daemon = True
    execution_thread.start()
    
    return True, None
