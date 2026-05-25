from django.urls import path
from . import views

urlpatterns = [
    path('execute/', views.execute_code_view, name='execute_code'),
    path('cheatsheet/', views.get_cheatsheet_data, name='get_cheatsheet_data'),
    path('provide_input', views.provide_input_view, name='provide_input'),
    path('check_status', views.check_status_view, name='check_status'),
    path('chat', views.chat_view, name='chat'),
    path('lint/', views.lint_code_view, name='lint_code'),
]
