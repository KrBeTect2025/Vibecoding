from django.core.management.base import BaseCommand
from executor.models import CheatsheetItem

class Command(BaseCommand):
    help = 'Populates the cheatsheet database with comprehensive Python data'

    def handle(self, *args, **kwargs):
        data = [
            # --- Keywords & Syntax ---
            {
                'category': 'Keywords',
                'name': 'def',
                'description': 'Used to define a function.',
                'syntax': 'def function_name(parameters):\n    statement(s)',
                'code_example': 'def my_function(arg1):\n    return arg1 + 1',
                'documentation_url': 'https://docs.python.org/3/reference/compound_stmts.html#function-definitions'
            },
            {
                'category': 'Keywords',
                'name': 'class',
                'description': 'Used to define a class.',
                'syntax': 'class ClassName(base_classes):\n    statement(s)',
                'code_example': 'class Dog:\n    def __init__(self, name):\n        self.name = name',
                'documentation_url': 'https://docs.python.org/3/reference/compound_stmts.html#class-definitions'
            },
            {
                'category': 'Keywords',
                'name': 'return',
                'description': 'Exits a function and optionally returns a value.',
                'syntax': 'return [expression_list]',
                'code_example': 'def add(a, b):\n    return a + b',
                'documentation_url': 'https://docs.python.org/3/reference/simple_stmts.html#the-return-statement'
            },
            {
                'category': 'Keywords',
                'name': 'lambda',
                'description': 'Creates an anonymous function.',
                'syntax': 'lambda arguments : expression',
                'code_example': 'square = lambda x: x ** 2\nprint(square(5))',
                'documentation_url': 'https://docs.python.org/3/reference/expressions.html#lambda'
            },
            
            # --- Control Flow ---
            {
                'category': 'Control Flow',
                'name': 'if/elif/else',
                'description': 'Conditional execution.',
                'syntax': 'if condition:\n    statement(s)\nelif condition:\n    statement(s)\nelse:\n    statement(s)',
                'code_example': 'x = 10\nif x > 0:\n    print("Positive")\nelif x < 0:\n    print("Negative")\nelse:\n    print("Zero")',
                'documentation_url': 'https://docs.python.org/3/tutorial/controlflow.html#if-statements'
            },
            {
                'category': 'Control Flow',
                'name': 'for loop',
                'description': 'Iterates over a sequence (list, tuple, string) or other iterable object.',
                'syntax': 'for item in iterable:\n    statement(s)',
                'code_example': 'fruits = ["apple", "banana"]\nfor fruit in fruits:\n    print(fruit)',
                'documentation_url': 'https://docs.python.org/3/tutorial/controlflow.html#for-statements'
            },
            {
                'category': 'Control Flow',
                'name': 'while loop',
                'description': 'Repeats a block of code as long as a condition is true.',
                'syntax': 'while condition:\n    statement(s)',
                'code_example': 'i = 0\nwhile i < 5:\n    print(i)\n    i += 1',
                'documentation_url': 'https://docs.python.org/3/reference/compound_stmts.html#while'
            },
            {
                'category': 'Control Flow',
                'name': 'break/continue',
                'description': 'break exits the loop; continue skips to the next iteration.',
                'syntax': 'break\ncontinue',
                'code_example': 'for i in range(10):\n    if i == 5:\n        break\n    if i % 2 == 0:\n        continue\n    print(i)',
                'documentation_url': 'https://docs.python.org/3/tutorial/controlflow.html#break-and-continue-statements'
            },

            # --- Built-in Functions ---
            {
                'category': 'Built-in Functions',
                'name': 'print()',
                'description': 'Prints objects to the text stream file.',
                'syntax': 'print(*objects, sep=" ", end="\\n", file=sys.stdout, flush=False)',
                'code_example': 'print("Hello", "World", sep="-")',
                'documentation_url': 'https://docs.python.org/3/library/functions.html#print'
            },
            {
                'category': 'Built-in Functions',
                'name': 'len()',
                'description': 'Returns the length (the number of items) of an object.',
                'syntax': 'len(s)',
                'code_example': 'len("Python") # Returns 6',
                'documentation_url': 'https://docs.python.org/3/library/functions.html#len'
            },
            {
                'category': 'Built-in Functions',
                'name': 'range()',
                'description': 'Returns an immutable sequence of numbers.',
                'syntax': 'range(stop)\nrange(start, stop[, step])',
                'code_example': 'list(range(0, 10, 2)) # [0, 2, 4, 6, 8]',
                'documentation_url': 'https://docs.python.org/3/library/stdtypes.html#range'
            },
            {
                'category': 'Built-in Functions',
                'name': 'input()',
                'description': 'Reads a line from input, converts it to a string.',
                'syntax': 'input([prompt])',
                'code_example': 'name = input("Enter your name: ")',
                'documentation_url': 'https://docs.python.org/3/library/functions.html#input'
            },
            {
                'category': 'Built-in Functions',
                'name': 'type()',
                'description': 'Returns the type of an object.',
                'syntax': 'type(object)',
                'code_example': 'type(123) # <class "int">',
                'documentation_url': 'https://docs.python.org/3/library/functions.html#type'
            },
            {
                'category': 'Built-in Functions',
                'name': 'enumerate()',
                'description': 'Returns an enumerate object (index, value) pairs.',
                'syntax': 'enumerate(iterable, start=0)',
                'code_example': 'for i, val in enumerate(["a", "b"]):\n    print(i, val)',
                'documentation_url': 'https://docs.python.org/3/library/functions.html#enumerate'
            },
            {
                'category': 'Built-in Functions',
                'name': 'zip()',
                'description': 'Iterates over several iterables in parallel.',
                'syntax': 'zip(*iterables)',
                'code_example': 'names = ["Alice", "Bob"]\nages = [25, 30]\nfor name, age in zip(names, ages):\n    print(name, age)',
                'documentation_url': 'https://docs.python.org/3/library/functions.html#zip'
            },

            # --- Data Structures ---
            {
                'category': 'Data Structures',
                'name': 'List',
                'description': 'Mutable sequence of items.',
                'syntax': 'my_list = [item1, item2, ...]',
                'code_example': 'nums = [1, 2, 3]\nnums.append(4)\nnums[0] = 10',
                'documentation_url': 'https://docs.python.org/3/tutorial/datastructures.html#more-on-lists'
            },
            {
                'category': 'Data Structures',
                'name': 'Dictionary',
                'description': 'Key-value pairs (mutable).',
                'syntax': 'my_dict = {key1: value1, key2: value2}',
                'code_example': 'user = {"name": "Alex", "age": 20}\nuser["email"] = "alex@example.com"',
                'documentation_url': 'https://docs.python.org/3/tutorial/datastructures.html#dictionaries'
            },
            {
                'category': 'Data Structures',
                'name': 'Tuple',
                'description': 'Immutable sequence of items.',
                'syntax': 'my_tuple = (item1, item2, ...)',
                'code_example': 'coords = (10, 20)\n# coords[0] = 5  # Raises TypeError',
                'documentation_url': 'https://docs.python.org/3/tutorial/datastructures.html#tuples-and-sequences'
            },
            {
                'category': 'Data Structures',
                'name': 'Set',
                'description': 'Unordered collection of unique elements.',
                'syntax': 'my_set = {item1, item2, ...}',
                'code_example': 'unique_nums = {1, 2, 2, 3} # {1, 2, 3}\nunique_nums.add(4)',
                'documentation_url': 'https://docs.python.org/3/tutorial/datastructures.html#sets'
            },
            {
                'category': 'Data Structures',
                'name': 'List Comprehension',
                'description': 'Concise way to create lists.',
                'syntax': '[expression for item in iterable if condition]',
                'code_example': 'squares = [x**2 for x in range(10)]',
                'documentation_url': 'https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions'
            },

            # --- String Methods ---
             {
                'category': 'String Methods',
                'name': '.upper() / .lower()',
                'description': 'Converts string case.',
                'syntax': 'string.upper()\nstring.lower()',
                'code_example': '"Hello".upper() # "HELLO"\n"Hello".lower() # "hello"',
                'documentation_url': 'https://docs.python.org/3/library/stdtypes.html#str.upper'
            },
            {
                'category': 'String Methods',
                'name': '.split()',
                'description': 'Splits string into a list.',
                'syntax': 'string.split(sep=None, maxsplit=-1)',
                'code_example': '"a,b,c".split(",") # ["a", "b", "c"]',
                'documentation_url': 'https://docs.python.org/3/library/stdtypes.html#str.split'
            },
            {
                'category': 'String Methods',
                'name': '.join()',
                'description': 'Joins elements of an iterable into a string.',
                'syntax': 'string.join(iterable)',
                'code_example': '"-".join(["a", "b", "c"]) # "a-b-c"',
                'documentation_url': 'https://docs.python.org/3/library/stdtypes.html#str.join'
            },
            {
                'category': 'String Methods',
                'name': '.strip()',
                'description': 'Removes leading/trailing whitespace.',
                'syntax': 'string.strip([chars])',
                'code_example': '"  hello  ".strip() # "hello"',
                'documentation_url': 'https://docs.python.org/3/library/stdtypes.html#str.strip'
            },
            {
                'category': 'String Methods',
                'name': '.replace()',
                'description': 'Replaces a substring with another.',
                'syntax': 'string.replace(old, new[, count])',
                'code_example': '"Hello World".replace("World", "Python")',
                'documentation_url': 'https://docs.python.org/3/library/stdtypes.html#str.replace'
            },

            # --- File Handling ---
            {
                'category': 'File Handling',
                'name': 'open() / read',
                'description': 'Opening and reading files.',
                'syntax': 'open(file, mode="r", ...)',
                'code_example': 'with open("file.txt", "r") as f:\n    content = f.read()',
                'documentation_url': 'https://docs.python.org/3/tutorial/inputoutput.html#reading-and-writing-files'
            },
            {
                'category': 'File Handling',
                'name': 'write',
                'description': 'Writing to files.',
                'syntax': 'file_object.write(string)',
                'code_example': 'with open("file.txt", "w") as f:\n    f.write("Hello File!")',
                'documentation_url': 'https://docs.python.org/3/tutorial/inputoutput.html#methods-of-file-objects'
            },

            # --- Error Handling ---
            {
                'category': 'Error Handling',
                'name': 'try/except',
                'description': 'Handling exceptions.',
                'syntax': 'try:\n    statement(s)\nexcept ExceptionType:\n    statement(s)',
                'code_example': 'try:\n    x = 1 / 0\nexcept ZeroDivisionError:\n    print("Cannot divide by zero")',
                'documentation_url': 'https://docs.python.org/3/tutorial/errors.html#handling-exceptions'
            },
            {
                'category': 'Error Handling',
                'name': 'finally',
                'description': 'Block that always executes.',
                'syntax': 'try:\n    statement(s)\nfinally:\n    statement(s)',
                'code_example': 'try:\n    f = open("file.txt")\nfinally:\n    f.close()',
                'documentation_url': 'https://docs.python.org/3/tutorial/errors.html#defining-clean-up-actions'
            },

            # --- Modules ---
            {
                'category': 'Modules',
                'name': 'import',
                'description': 'Importing modules.',
                'syntax': 'import module_name',
                'code_example': 'import math\nprint(math.sqrt(16))',
                'documentation_url': 'https://docs.python.org/3/tutorial/modules.html'
            },
            {
                'category': 'Modules',
                'name': 'from ... import',
                'description': 'Importing specific attributes.',
                'syntax': 'from module_name import name1, name2',
                'code_example': 'from datetime import datetime\nprint(datetime.now())',
                'documentation_url': 'https://docs.python.org/3/tutorial/modules.html#more-on-modules'
            }
        ]

        self.stdout.write('Populating cheatsheet data...')
        
        # Clear existing data to avoid duplicates if run multiple times
        CheatsheetItem.objects.all().delete()
        
        for item_data in data:
            CheatsheetItem.objects.create(**item_data)
            
        self.stdout.write(self.style.SUCCESS(f'Successfully populated cheatsheet with {len(data)} items'))
