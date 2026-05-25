from django.db import models

class CheatsheetItem(models.Model):
    category = models.CharField(max_length=100)
    name = models.CharField(max_length=100)
    description = models.TextField()
    syntax = models.TextField(blank=True)
    code_example = models.TextField(blank=True)
    documentation_url = models.URLField(blank=True)

    def __str__(self):
        return f"{self.category}: {self.name}"
