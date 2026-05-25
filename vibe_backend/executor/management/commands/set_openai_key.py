import os
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Set the OPENAI_API_KEY in a .env file (server-side). This will create or update vibe_backend/.env'

    def add_arguments(self, parser):
        parser.add_argument('--key', type=str, help='OpenAI API key to store')
        parser.add_argument('--path', type=str, default=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '..', '.env'), help='Path to write .env (default: vibe_backend/.env)')

    def handle(self, *args, **options):
        key = options.get('key')
        # Resolve default path relative to manage.py location
        default_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '..'))
        default_env_path = os.path.join(default_dir, '.env')
        env_path = options.get('path') or default_env_path

        if not key:
            # interactive prompt
            try:
                key = input('Enter OpenAI API key (will be saved to {}): '.format(env_path)).strip()
            except Exception:
                raise CommandError('No key provided')

        if not key:
            raise CommandError('Empty key provided; aborting')

        # Ensure directory exists
        env_dir = os.path.dirname(env_path)
        if env_dir and not os.path.exists(env_dir):
            try:
                os.makedirs(env_dir, exist_ok=True)
            except Exception as e:
                raise CommandError(f'Failed to create directory for .env: {e}')

        # Write .env (overwrite or create)
        try:
            with open(env_path, 'w', encoding='utf-8') as f:
                f.write(f'OPENAI_API_KEY={key}\n')
        except Exception as e:
            raise CommandError(f'Failed to write .env file: {e}')

        self.stdout.write(self.style.SUCCESS(f'Wrote OpenAI key to {env_path}'))
