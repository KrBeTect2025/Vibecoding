#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
try:
    # Load .env file if present so os.getenv picks up OPENAI_API_KEY
    from dotenv import load_dotenv
    base_dir = os.path.dirname(__file__)
    env_path = os.path.join(base_dir, '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
except Exception:
    # If python-dotenv isn't installed or loading fails, continue without failing
    pass


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibe_backend.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
