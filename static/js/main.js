// Setup document elements
const doctor_select = document.getElementById("doctor-selection")
const ui_bar = document.getElementById("ui-bar")
const current_name = document.getElementById("doctor-selection-name")

const replace_dialog = document.getElementById("replace-dialog")
const date_table = document.getElementById("date-table")

// Setup mutable elements
let current_column = null


// Send from data from "doctor-selection" and updates database
function set_doctor(set_method="append") {
    // Ensure we keep working on the same cell
    let local_column = current_column
    let form_data = new FormData(doctor_select)

    // Append the content we expect to override.
    form_data.set("date", local_column.previousElementSibling.classList[2])
    form_data.set("current_entry", local_column.innerText)
    form_data.set("set_method", set_method)

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

            // Display correct text when entry was deleted
            if(response === "empty") {
                local_column.classList.add("not-assigned")
                response = "[Nicht vergeben]"
            }

            // Signal changes were made in the meantime
            else if(response !== current_name.value)
                local_column.classList.add("revisit")

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

    // Get information about year to display and optional name filters
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

            // Scroll to display current date, if in table
            let today = document.getElementsByClassName("today")
            if(today.length > 0)
                today[0].scrollIntoView()
        })
}

/**
 * Global listener for mouse clicks, acts only when table cells were selected. Fires set_doctor or relocates
 * Doctor-Select next to the selected cell.
 * @param event
 */
function on_cell_click(event) {

    // Don't do anything, if no name-cell was selected
    if(!event.target.classList.contains("name-cell"))
        return

    // Set current cell
    current_column = event.target

    // If nothing is assigned to this cell, update using the last selected name
    if (current_column.classList.contains("not-assigned")
        && current_name.value !== "none"
        && current_name.value !== "delete")
        set_doctor("replace")

    // Otherwise reset select-element
    else
        current_name.value = "none"

    // Display "doctor-selection" form next to the selected cell
    current_column.nextElementSibling.appendChild(doctor_select)
}


// Main

// Setup event listeners


// Listen for Changes on Doctor-Select
doctor_select.addEventListener("change", (event) => {

    // Don't act if nothing is selected
    if(!current_column || event.target.value === "none")
        return

    // If nothing was assigned before, fill in the selected name
    if(current_column.classList.contains("not-assigned"))
        set_doctor("replace")

    // Send delete-Request
    else if(event.target.value === "delete")
        set_doctor("delete")

    // If something was assigned to the current date, prompt user to inquire further action
    else
        replace_dialog.showModal()

})


// Listen to changes in the doctor-filter Select
ui_bar.addEventListener("change", (event) => {
    load_content()
})


// Listen for Replace-Dialog closing
replace_dialog.addEventListener("close", (event) => {

    // Only act if a valid option was supplied
    if(["replace", "append"].includes(replace_dialog.returnValue))
        set_doctor(replace_dialog.returnValue)

    // Reset Dialog for next use
    replace_dialog.returnValue = ""
})


// Global listener for Mouse clicks
date_table.addEventListener("click", on_cell_click)

// Display current year
document.getElementById("year-filter").value = new Date(Date.now()).getFullYear()

// Load page content
load_content()

