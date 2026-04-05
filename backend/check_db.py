from app.services.db import get_connection

def check_notebooks_table():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT name FROM sqlite_master WHERE type="table" AND name="notebooks"')
        result = cursor.fetchone()
        print('Notebooks table exists:', result is not None)

        # List all tables
        cursor.execute('SELECT name FROM sqlite_master WHERE type="table"')
        tables = cursor.fetchall()
        print('All tables:', [table[0] for table in tables])

        conn.close()
    except Exception as e:
        print('Error:', e)

if __name__ == "__main__":
    check_notebooks_table()