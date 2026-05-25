from pyflakes.api import check
from pyflakes.reporter import Reporter
import io
import builtins
import difflib
import re

def test_lint(code):
    print(f"Testing code: {code}")
    warning_stream = io.StringIO()
    error_stream = io.StringIO()
    reporter = Reporter(warning_stream, error_stream)
    
    check(code, 'input', reporter)
    
    output = warning_stream.getvalue() + error_stream.getvalue()
    print(f"Raw output: {output}")
    
    errors = []
    for line in output.splitlines():
        parts = line.split(':')
        if len(parts) >= 4:
            lineno = int(parts[1])
            message = ':'.join(parts[3:]).strip()
            
            suggestion = ""
            if "undefined name" in message:
                match = re.search(r"undefined name '([^']+)'", message)
                if match:
                    undefined_name = match.group(1)
                    candidates = dir(builtins) + ['def', 'class', 'import', 'from', 'return', 'print']
                    matches = difflib.get_close_matches(undefined_name, candidates, n=1, cutoff=0.6)
                    if matches:
                        suggestion = f" Did you mean '{matches[0]}'?"
            
            errors.append({
                'line': lineno,
                'message': f"{message}{suggestion}"
            })
    
    print(f"Parsed errors: {errors}")

test_lint("prnt('hello')")
