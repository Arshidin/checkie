#!/usr/bin/env python3
"""
Скрипт для удаления Stripe Design System CSS из всех страниц, кроме Dashboard
Дизайн-система должна применяться ТОЛЬКО для Dashboard страниц
"""

import re
from pathlib import Path

# Путь к директории pages
PAGES_DIR = Path(__file__).parent.parent / "pages"

# Блок CSS дизайн-системы для удаления
DESIGN_SYSTEM_CSS_BLOCK = r'  <!-- Stripe Design System -->\s*<link href="/assets/css/design-system/tokens\.css"[^>]*>\s*<link href="/assets/css/design-system/base\.css"[^>]*>\s*<link href="/assets/css/design-system/utilities\.css"[^>]*>\s*<link href="/assets/css/design-system/components\.css"[^>]*>\s*<link href="/assets/css/design-system/legacy-compat\.css"[^>]*>\s*<!-- Legacy styles \(will be gradually removed\) -->\s*'

def remove_ds_from_file(file_path):
    """Удаляет дизайн-систему из HTML файла (если это не dashboard)"""
    try:
        # Проверяем, это dashboard страница?
        is_dashboard = 'dashboard' in str(file_path)
        
        if is_dashboard:
            print(f"  ✓ {file_path.name} - Dashboard, оставляем дизайн-систему")
            return False
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем, есть ли дизайн-система
        if 'design-system/tokens.css' not in content:
            print(f"  - {file_path.name} - дизайн-система не найдена")
            return False
        
        # Удаляем блок дизайн-системы
        pattern = re.compile(DESIGN_SYSTEM_CSS_BLOCK, re.MULTILINE)
        new_content = pattern.sub('', content)
        
        if new_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"  ✓ {file_path.name} - дизайн-система удалена")
            return True
        else:
            print(f"  ✗ {file_path.name} - паттерн не найден")
            return False
    except Exception as e:
        print(f"  ✗ {file_path.name} - ошибка: {e}")
        return False

def main():
    """Главная функция"""
    html_files = list(PAGES_DIR.rglob("*.html"))
    print(f"Найдено {len(html_files)} HTML файлов")
    print("Удаляем дизайн-систему из всех страниц, кроме Dashboard...\n")
    
    removed = 0
    for html_file in html_files:
        if remove_ds_from_file(html_file):
            removed += 1
    
    print(f"\nДизайн-система удалена из {removed} файлов")
    print("Дизайн-система осталась только в Dashboard страницах")

if __name__ == "__main__":
    main()
