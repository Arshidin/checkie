#!/usr/bin/env python3
"""
Скрипт для обновления порядка загрузки CSS во всех HTML файлах
Добавляет Stripe Design System CSS файлы
"""

import os
import re
from pathlib import Path

# Путь к директории pages
PAGES_DIR = Path(__file__).parent.parent / "pages"

# CSS блок для вставки
DESIGN_SYSTEM_CSS = """  <!-- Stripe Design System -->
  <link href="/assets/css/design-system/tokens.css" rel="stylesheet" type="text/css">
  <link href="/assets/css/design-system/base.css" rel="stylesheet" type="text/css">
  <link href="/assets/css/design-system/utilities.css" rel="stylesheet" type="text/css">
  <link href="/assets/css/design-system/components.css" rel="stylesheet" type="text/css">
  <link href="/assets/css/design-system/legacy-compat.css" rel="stylesheet" type="text/css">
  <!-- Legacy styles (will be gradually removed) -->"""

# Паттерн для поиска блока CSS
CSS_PATTERN = re.compile(
    r'(<link href="/assets/css/normalize\.css" rel="stylesheet" type="text/css">\s*<link href="/assets/css/webflow\.css" rel="stylesheet" type="text/css">)',
    re.MULTILINE
)

def update_html_file(file_path):
    """Обновляет один HTML файл"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем, не обновлен ли уже файл
        if 'design-system/tokens.css' in content:
            print(f"  ✓ {file_path.name} - уже обновлен")
            return False
        
        # Заменяем блок CSS
        new_content = CSS_PATTERN.sub(
            r'\1\n' + DESIGN_SYSTEM_CSS,
            content
        )
        
        if new_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"  ✓ {file_path.name} - обновлен")
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
    
    updated = 0
    for html_file in html_files:
        if update_html_file(html_file):
            updated += 1
    
    print(f"\nОбновлено файлов: {updated}/{len(html_files)}")

if __name__ == "__main__":
    main()
