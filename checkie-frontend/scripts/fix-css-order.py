#!/usr/bin/env python3
"""
Скрипт для исправления порядка загрузки CSS во всех HTML файлах
Правильный порядок: normalize -> webflow -> design-system -> checkie-stage
"""

import os
import re
from pathlib import Path

# Путь к директории pages
PAGES_DIR = Path(__file__).parent.parent / "pages"

# Правильный блок CSS
CORRECT_CSS_ORDER = """  <link href="/assets/css/normalize.css" rel="stylesheet" type="text/css">
  <link href="/assets/css/webflow.css" rel="stylesheet" type="text/css">
  <!-- Stripe Design System -->
  <link href="/assets/css/design-system/tokens.css" rel="stylesheet" type="text/css">
  <link href="/assets/css/design-system/base.css" rel="stylesheet" type="text/css">
  <link href="/assets/css/design-system/utilities.css" rel="stylesheet" type="text/css">
  <link href="/assets/css/design-system/components.css" rel="stylesheet" type="text/css">
  <link href="/assets/css/design-system/legacy-compat.css" rel="stylesheet" type="text/css">
  <!-- Legacy styles (will be gradually removed) -->
  <link href="/assets/css/checkie-stage.webflow.css" rel="stylesheet" type="text/css">"""

def fix_html_file(file_path):
    """Исправляет порядок CSS в одном HTML файле"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем, есть ли design-system
        if 'design-system/tokens.css' not in content:
            return False
        
        # Ищем блок с CSS ссылками
        # Паттерн для поиска всех CSS ссылок между normalize и checkie-stage
        pattern = re.compile(
            r'(<link href="/assets/css/normalize\.css"[^>]*>.*?<link href="/assets/css/checkie-stage\.webflow\.css"[^>]*>)',
            re.DOTALL
        )
        
        match = pattern.search(content)
        if match:
            # Заменяем на правильный порядок
            new_content = pattern.sub(CORRECT_CSS_ORDER, content)
            if new_content != content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"  ✓ {file_path.name} - исправлен")
                return True
        
        return False
    except Exception as e:
        print(f"  ✗ {file_path.name} - ошибка: {e}")
        return False

def main():
    """Главная функция"""
    html_files = list(PAGES_DIR.rglob("*.html"))
    print(f"Найдено {len(html_files)} HTML файлов")
    
    fixed = 0
    for html_file in html_files:
        if fix_html_file(html_file):
            fixed += 1
    
    print(f"\nИсправлено файлов: {fixed}/{len(html_files)}")

if __name__ == "__main__":
    main()
