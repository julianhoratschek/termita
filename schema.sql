create table if not exists doctors
(
    first_name TEXT not null,
    last_name  TEXT not null
        constraint name
            primary key
);

create table if not exists time_table
(
    id     integer not null
        constraint time_table_pk
            primary key autoincrement,
    doctor TEXT    not null
        constraint doctor_name
            references doctors,
    date   integer
);

insert into doctors (first_name, last_name)
    values ('Diana', 'Daher'),
           ('Karita', 'Krause'),
           ('Julian', 'Horatschek'),
           ('Ana', 'Kolenda'),
           ('Mascha', 'Morschek'),
           ('Wiebke', 'Zimmermann'),
           ('Britta', 'Koch'),
           ('Tamina', 'Nichici'),
           ('Marlene', 'Wegemann'),
           ('Regina', 'Banarer')