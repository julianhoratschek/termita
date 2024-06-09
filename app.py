import sqlite3
from flask import Flask, request, render_template, g
from markupsafe import escape
from datetime import date, timedelta
import locale

# TODO: Terminalternativen
# TODO: Feiertage


# Initialize App
app = Flask(__name__)
locale.setlocale(locale.LC_TIME, 'de_DE')


def init_db() -> sqlite3.Connection:
    """ Initialize the database. """
    if "db" not in g:
        g.db = sqlite3.connect("database.sqlite")

    return g.db


def get_date_entries(db, sql_query, params) -> dict[int, str]:
    return {date_ord: doctor_name for date_ord, doctor_name in db.execute(sql_query, params).fetchall()}


@app.teardown_appcontext
def close_db(error):
    """ Close the database again at the end of the request. """
    if "db" in g:
        g.db.close()
        g.db = None


@app.template_filter("dt")
def date_to_string(value: date, date_format: str = "%a, %d. %B") -> str:
    """ Jinja template filter to convert a date to a string. """
    return value.strftime(date_format)


@app.template_filter("ord")
def date_to_ord(value: date) -> int:
    """ Jinja template filter to convert a date to an ordinal. """
    return value.toordinal()


@app.template_filter("weekday_class")
def get_weekday_class(value: date) -> str:
    """ Jinja template filter to generate a class list: returns saturday, sunday or weekday with additional
     today-class if value is today."""
    return {
        5: "saturday",
        6: "sunday"
    }.get(value.weekday(), "weekday") + (" today" if value == date.today() else "")


@app.route("/create_db")
def create_db():
    db: sqlite3.Connection = init_db()

    with app.open_resource("schema.sql", mode="r") as f:
        db.executescript(f.read())

    return "Database created"


@app.post('/filter')
def get_filter():
    """Get entries for a specified year, optionally filtered by a doctor name.
    """

    # Connect to the Database
    db: sqlite3.Connection = init_db()

    # Get POST-Request: year and optional filter name
    year: int = request.form.get("year", default=date.today().year, type=int)
    doctor_filter: str = request.form.get("filter_name", default="*", type=str)

    # Get range of dates to display (default: full year)
    # TODO: Filter by Month? Quarter?
    start_date: date = date(year, 1, 1)
    end_date: date = start_date + timedelta(days=365)

    # If all entries should be selected, get entries and fill date list with each day of the year
    if doctor_filter == "all":
        entries: dict[int, str] = get_date_entries(db,
                                                   "SELECT `date`, `doctor` FROM time_table "
                                                   "WHERE `date` >= ? AND `date` <= ?  ORDER BY `date`",
                                                   (start_date.toordinal(), end_date.toordinal()))
        dates: list[date] = [start_date + timedelta(days=delta) for delta in range(0, 366)]

    # Otherwise get filtered entries and fill date list only with necessary days
    else:
        entries: dict[int, str] = get_date_entries(db,
                                                   "SELECT `date`, `doctor` FROM time_table "
                                                   "WHERE `date` >= ? AND `date` <= ? AND `doctor` = ? ORDER BY `date`",
                                                   (start_date.toordinal(), end_date.toordinal(), doctor_filter))
        dates: list[date] = [date.fromordinal(entry) for entry in entries.keys()]

    # Render template
    return render_template("table_contents.html",
                           dates=dates,
                           entries=entries)


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
        at_date: int = int(request.form["date"][1:])

    except (ValueError, KeyError) as e:
        return escape(str(e))

    # If deletion was selected, try to delete the specified entry
    if write_entry == "delete":
        db.execute("DELETE FROM time_table "
                   "WHERE `date` = ? AND `doctor` = ?",
                   (at_date, current_entry))

    # Otherwise insert or update table
    else:
        # Try to get a calendar entry at the selected date
        entries = db.execute("SELECT `doctor`, `id` FROM time_table "
                             "WHERE `date` = ? LIMIT 1", (at_date,))\
                    .fetchone()

        # If any entry was present
        if entries:
            # If the entries name differs from the expected value to overwrite, abort query.
            if current_entry != entries[0]:
                return escape(entries[0])

            # Otherwise overwrite entry
            db.execute("UPDATE time_table SET `doctor` = ? WHERE `id` = ?",
                       (write_entry, entries[1]))

        # If no calendar entry was present, create new entry
        else:
            db.execute("INSERT INTO time_table (`date`, `doctor`) VALUES (?, ?)",
                       (at_date, write_entry))

    # Commit changes
    db.commit()
    return escape(write_entry)


if __name__ == '__main__':
    app.run()
