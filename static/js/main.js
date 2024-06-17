// Setup document elements
const doctor_select = document.getElementById("doctor-selection-form")
const ui_bar = document.getElementById("ui-bar")
const current_name = document.getElementById("doctor-name-select")

const replace_dialog = document.getElementById("replace-dialog")
const delete_dialog = document.getElementById("remove-from-group-dialog")
const delete_name_select = document.getElementById("remove-name-select")
const date_table = document.getElementById("date-table")

// Setup mutable elements
let current_column = null


/**
 * Send from data from "doctor-selection" and updates database
 * @param set_method - One of three values: "append", "replace", "delete"
 * @param set_name - if set_method is "append": The name to append to cell content. If set_method is "replace": The
 *                      name to replace cell content with. If set_method is "delete": The name to delete from cell
 *                      content.
 */
function set_doctor(set_method="append", set_name = "") {
    // Don't make API call if current name is already set
    if(set_method !== "delete" && current_column.textContent.includes(set_name))
        return

    // Ensure we keep working on the same cell
    const local_column = current_column
    const form_data = new FormData()

    // Append the content we expect to override.
    form_data.set("add_name", set_name)
    form_data.set("date", local_column.previousElementSibling.classList[2])
    form_data.set("current_entry", local_column.innerText)
    form_data.set("set_method", set_method)

    const request = new Request("set", {
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
            local_column.classList.remove("not-assigned", "revisit", "changed", "multiple-entries")

            // Display correct text when entry was deleted
            if(response === "empty") {
                local_column.classList.add("not-assigned")
                response = "[Nicht vergeben]"
            }

            // If we get another name back, the cell was edited by someone else before our send-reqeust
            else if(response !== current_name.value)
                local_column.classList.add("revisit")

            // Show success
            else
                local_column.classList.add("changed")

            local_column.innerHTML = response
        })
}

/**
 * Display entries in date-table.
 */
function load_content() {

    // Get information about year to display and optional name filters
    const form_data = new FormData(ui_bar)
    const request = new Request("/filter", {
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
            const today = document.getElementsByClassName("today")
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

    // Don't do anything, if no name-cell was selected or the name is already present in the cell
    if(!event.target.classList.contains("name-cell"))
        return

    // Set current cell
    current_column = event.target

    // If nothing is assigned to this cell, update using the last selected name
    if (current_column.classList.contains("not-assigned")
        && current_name.value !== "none"
        && current_name.value !== "delete")
        set_doctor("replace", current_name.value)

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
        set_doctor("replace", current_name.value)

    // Send delete-Request
    else if(event.target.value === "delete") {
        if(current_column.innerText.includes(",")) {
            let options = [document.createElement("option")]
            options[0].text = "[Abbrechen]"
            options[0].value = "abort"

            current_column.innerText.split(", ").forEach((e) => {
                let option = document.createElement("option")
                option.value = e
                option.text = e

                options.push(option)
            })
            delete_name_select.replaceChildren(...options)
            delete_name_select.value = "abort"

            delete_dialog.showModal()
        }
        else
            set_doctor("delete", current_column.innerText)

    }
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
        set_doctor(replace_dialog.returnValue, current_name.value)

    // Reset Dialog for next use
    replace_dialog.returnValue = ""
})


delete_name_select.addEventListener("change", (event) => {
    if(event.target.value !== "abort")
        set_doctor("delete", event.target.value)

    delete_dialog.close()
})


// Global listener for Mouse clicks
date_table.addEventListener("click", on_cell_click)

// Display current year
document.getElementById("year-filter").value = new Date(Date.now()).getFullYear()

// Load page content
load_content()

