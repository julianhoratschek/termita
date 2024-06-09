// Setup document elements
const doctor_select = document.getElementById("doctor-selection")
const ui_bar = document.getElementById("ui-bar")
const current_name = document.getElementById("doctor-selection-name")
const current_date = document.getElementById("doctor-selection-date")
const date_table = document.getElementById("date-table")

// Setup mutable elements
let current_column = null


// Send from data from "doctor-selection" and updates database
function set_doctor(doctor_name) {
    // Ensure we keep working on the same cell
    let local_column = current_column
    let form_data = new FormData(doctor_select)

    // Append the content we expect to override.
    form_data.set("current_entry", local_column.innerText)

    let request = new Request("set", {
        method: "POST",
        body: form_data
    })

    fetch(request)
        .then((response) => {
            if(!response.ok)
                throw new Error("Could not reach server.")
            return response.text()
        })

        .then((response) => {
            // If we get another name back, the cell was edited by someone else before our send-reqeust
            local_column.classList.remove("not-assigned")

            // Signal changes were made in the meantime
            if(response !== doctor_name)
                local_column.classList.add("revisit")

            // Display correct text when entry was deleted
            else if(response === "delete") {
                local_column.classList.add("not-assigned")
                response = "[Nicht vergeben]"
            }

            // Show success
            else
                local_column.classList.add("changed")

            local_column.innerText = response
        })
}

/**
 * Display entries in date-table.
 */
function load_content() {
    let form_data = new FormData(ui_bar)
    let request = new Request("/filter", {
        method: "POST",
        body: form_data
    })

    // Rescue "doctor-select" form from deletion
    document.body.appendChild(doctor_select)

    fetch(request)
        .then((response) => {
            if(!response.ok)
                throw new Error("Could not load data")
            return response.text()
        })

        .then((html) => {
            date_table.innerHTML = html

            let today = document.getElementsByClassName("today")
            if(today.length > 0)
                today[0].scrollIntoView()
        })
}

function on_cell_click(event) {
    if(!event.target.classList.contains("name-cell"))
        return

    current_column = event.target
    current_date.value = current_column.previousElementSibling.classList[2]

    // If nothing is assigned to this cell, update using the last selected name
    if (current_column.classList.contains("not-assigned")
        && current_name.value !== "none"
        && current_name.value !== "delete")
        set_doctor(current_name.value)

    // Otherwise reset select-element
    else
        current_name.value = "none"

    // Display "doctor-selection" form next to the selected cell
    current_column.nextElementSibling.appendChild(doctor_select)
}

// Main

doctor_select.addEventListener("change", (event) => {
    if(!current_column || event.target.value === "none")
        return

    set_doctor(event.target.value)
})

ui_bar.addEventListener("change", (event) => {
    load_content()
})

date_table.addEventListener("click", on_cell_click)

document.getElementById("year-filter").value = new Date(Date.now()).getFullYear()
load_content()

