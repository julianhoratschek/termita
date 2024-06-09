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

    let request = new Request("add", {
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
            if(response !== doctor_name)
                local_column.classList.add("revisit")
            else
                local_column.classList.add("changed")

            local_column.innerText = response
            local_column.classList.remove("not-assigned")
        })
}

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

// Set bubbling Event-Listeners

doctor_select.addEventListener("change", (event) => {
    if(!current_column || event.target.value === "none")
        return

    set_doctor(event.target.value)
})

ui_bar.addEventListener("change", (event) => {
    load_content()
})

addEventListener("dblclick", (event) => {
    // Only react to clicks on specific cells (name-cells)
    if(!event.target.classList.contains("name-column"))
        return

    current_column = event.target
    current_date.value = current_column.previousElementSibling.classList[2]

    // If nothing is assigned to this cell, update using the last selected name
    if(current_column.classList.contains("not-assigned") && current_name.value !== "none")
        set_doctor(current_name.value)

    // Otherwise reset select-element
    else
        current_name.value = "none"

    // Display "doctor-selection" form next to the selected cell
    current_column.nextElementSibling.appendChild(doctor_select)
})


// Main

document.getElementById("year-filter").value = new Date(Date.now()).getFullYear()
load_content()

