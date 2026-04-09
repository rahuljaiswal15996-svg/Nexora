from app.services.db import DBCursor


class _RowReturningResult:
    returns_rows = True
    rowcount = 1

    def keys(self):
        return ("value",)

    @property
    def lastrowid(self):
        raise AssertionError("lastrowid should not be accessed for row-returning results")

    def fetchone(self):
        return (1,)

    def fetchall(self):
        return [(1,)]


class _WriteResult:
    returns_rows = False
    rowcount = 1
    lastrowid = 42

    def keys(self):
        return ()

    def fetchone(self):
        return None

    def fetchall(self):
        return []


def test_db_cursor_avoids_lastrowid_for_row_returning_results():
    cursor = DBCursor(connection=None)

    cursor._set_result(_RowReturningResult())

    row = cursor.fetchone()
    assert row is not None
    assert row[0] == 1
    assert row["value"] == 1
    assert cursor.lastrowid is None


def test_db_cursor_preserves_lastrowid_for_write_results():
    cursor = DBCursor(connection=None)

    cursor._set_result(_WriteResult())

    assert cursor.lastrowid == 42