from app.services.db import list_table_names

def check_notebooks_table():
    try:
        tables = list_table_names()
        print('Notebooks table exists:', 'notebooks' in tables)
        print('All tables:', tables)
    except Exception as e:
        print('Error:', e)

if __name__ == "__main__":
    check_notebooks_table()