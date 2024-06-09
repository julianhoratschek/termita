import sqlite3
from flask import Flask, request, render_template, g
from markupsafe import escape
from datetime import date, timedelta
from itertools import groupby

# TODO: Feiertage


# Initialize App
app = Flask(__name__)


def init_db() -> sqlite3.Connection:
    """ Initialize the database.
    """

    if "db" not in g:
        g.db = sqlite3.connect("/var/data/database.sqlite")
        # g.db = sqlite3.connect("database.sqlite")

    return g.db


def get_date_entries(sql_query, params) -> dict[int, str]:
    """Executes sql_query with params, joins all names with the same date to a string and returns
    it as a dictionary mapping date-ordinal to that string.

    :param sql_query: SQL query to execute, expects a SELECT-query.
    :param params: Parameters to pass to sql_query.
    :return: Dictionary mapping gregorian date-ordinals to a string.
    """

    return {date_ord: ", ".join(list(zip(*doctor_names))[1]) for date_ord, doctor_names
            in groupby(g.db.execute(sql_query, params).fetchall(), lambda x: x[0])}


@app.teardown_appcontext
def close_db(error):
    """ Close the database again at the end of the request.
    """

    if "db" in g:
        g.db.close()
        g.db = None


@app.template_filter("month")
def date_month(value: date) -> str:
    """Jinja template filter to convert date to german month name.
    Workaround for missing locale-settings on Server.
    :param value: date to convert.
    :return: String representation german month name.
    """

    return ("Januar", "Februar", "März", "April", "Mai", "Juni", "Juli",
            "August", "September", "Oktober", "November", "Dezember")[value.month - 1]


@app.template_filter("dt")
def date_to_string(value: date) -> str:
    """ Jinja template filter to convert a date to a german date representation.
    Workaround for missing locale-settings on Server.
    :param value: date to convert.
    :return: String representation of german date format.
    """

    return (("Mo", "Di", "Mi", "Do", "Fr", "Sa", "So")[value.weekday()] + ", "
            + f"{value.day:02d}. "
            + date_month(value))


@app.template_filter("ord")
def date_to_ord(value: date) -> int:
    """ Jinja template filter to convert a date to an ordinal.
    """

    return value.toordinal()


@app.template_filter("weekday_class")
def get_weekday_class(value: date) -> str:
    """ Jinja template filter to generate a class list: returns saturday, sunday or weekday with additional
     today-class if value is today."""
    return {
        5: "saturday",
        6: "sunday"
    }.get(value.weekday(), "weekday") + (" today" if value == date.today() else "")


@app.post('/filter')
def get_filter():
    """Get entries for a specified year, optionally filtered by a doctor name.
    """

    # Connect to the Database
    init_db()

    # Get POST-Request: year and optional filter name
    year: int = request.form.get("year", default=date.today().year, type=int)
    doctor_filter: str = request.form.get("filter_name", default="*", type=str)

    # Get range of dates to display (default: full year)
    # TODO: Filter by Month? Quarter?
    start_date: date = date(year, 1, 1)
    end_date: date = start_date + timedelta(days=365)

    # If all entries should be selected, get entries and fill date list with each day of the year
    if doctor_filter == "all":
        entries: dict[int, str] = get_date_entries("SELECT `date`, `doctor` FROM time_table "
                                                   "WHERE `date` BETWEEN ? AND ?  "
                                                   "ORDER BY `date`, `doctor`",
                                                   (start_date.toordinal(), end_date.toordinal()))
        dates: list[date] = [start_date + timedelta(days=delta) for delta in range(0, 366)]

    # Otherwise get filtered entries and fill date list only with necessary days
    else:
        entries: dict[int, str] = get_date_entries("SELECT `date`, `doctor` FROM time_table "
                                                   "WHERE `date` BETWEEN ? AND ? AND `doctor` = ? "
                                                   "ORDER BY `date`, `doctor`",
                                                   (start_date.toordinal(), end_date.toordinal(), doctor_filter))
        dates: list[date] = [date.fromordinal(entry) for entry in entries.keys()]

    # Render template
    return render_template("table_contents.html",
                           dates=dates,
                           entries=entries)


@app.post('/set')
def set_entry():
    """ Adds, overwrites or deletes an entry in the calendar. If the entry was modified in the meantime,
    nothing will happen and the updated name will be returned.

    :return: Escaped String of the inserted name. If the name was updated before this method was called,
    the new name will be returned."""

    # Initialize Database
    db: sqlite3.Connection = init_db()

    # Get POST data
    try:
        current_entry: str = request.form["current_entry"]
        write_entry: str = request.form["add_name"]
        set_method: str = request.form["set_method"]
        at_date: int = int(request.form["date"][1:])

    except (ValueError, KeyError) as e:
        return escape(str(e))

    # Try to get a calendar entry at the selected date
    entries: list[str] = []
    result: list = db.execute("SELECT `doctor` FROM time_table "
                              "WHERE `date` = ? ORDER BY `doctor`", (at_date,))\
                     .fetchall()

    # Abort if current database state does not match expected state
    if result:
        entries = list(next(zip(*result)))

        if (match_names := ", ".join(entries)) != current_entry:
            return escape(match_names)

    # If deletion was selected, try to delete the specified entry
    if set_method in ("delete", "replace"):
        entries = []
        db.execute("DELETE FROM time_table "
                   "WHERE `date` = ?",
                   (at_date,))

    # If insertion was selected, insert new data
    if set_method in ("append", "replace"):
        entries.append(write_entry)
        db.execute("INSERT INTO time_table (`date`, `doctor`) VALUES (?, ?)",
                   (at_date, write_entry))

    # Commit changes
    db.commit()

    if entries:
        return escape(", ".join(sorted(entries)))

    return "empty"


@app.route('/')
def get_main():
    """ Displays main view. Table content will be loaded via fetch from client side."""

    # Initialize Database
    db: sqlite3.Connection = init_db()

    # Get all registered users of the calendar
    doctors: list[str] = [name[0] for name in db.execute("SELECT `last_name` FROM doctors ORDER BY `last_name`")
                                                .fetchall()]

    return render_template("time_table.html",
                           doctors=doctors)


if __name__ == '__main__':
    app.run()
