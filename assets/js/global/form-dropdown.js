document.addEventListener("DOMContentLoaded", function(event) {
  // Ensure the event is trusted
  if (!event.isTrusted) return;

  const forms = document.querySelectorAll("form.global-functionality");
  if (!forms || forms.length < 1) return;

  [...forms].forEach((form) => {
    const dropdowns = form.querySelectorAll(".form-group .dropdown:not(.excluded-js)");

    if (!dropdowns || dropdowns.length < 1) return;

    [...dropdowns].forEach((dropdown) => {
      const dropdownInput = dropdown.querySelector("input.dropdown-toggle");
      const dropdownBtn = dropdown.querySelector("button.dropdown-toggle");
      const dropdownMenu = dropdown.querySelector(".dropdown-menu");
      const dropdownItems = dropdownMenu.querySelectorAll(".dropdown-item");

      // Display the dropdown menu
      (dropdownInput || dropdownBtn)?.addEventListener("focus", function(event) {
        dropdownMenu.classList.add("show");
      });
      (dropdownInput || dropdownBtn)?.addEventListener("blur", function(event) {
        setTimeout(() => dropdownMenu.classList.remove("show"), 300);
      });

      // Filter the dropdown menu
      dropdown.addEventListener("keyup", function(event) {
        let input = event.target;
        let filter = input.value.toUpperCase();
        let dropdown = (event.target).parentElement;
        let li = dropdown.querySelectorAll("ul > li");

        for (let i = 0; i < li.length; i++) {
          txtValue = li[i].textContent || li[i].innerText;
          if (txtValue.toUpperCase().indexOf(filter) > -1) {
            li[i].style.display = "";
          } else {
            li[i].style.display = "none";
          }
        }
      });

      dropdownItems.forEach((item) => {
        item.addEventListener("click", function() {
          console.log("Item clicked");
          // Ensure the item isn't already selected
          if (item.classList.contains("selected")) return;

          console.log("Item clicked 1");

          // Remove all selected classes
          form.querySelectorAll(".dropdown-menu .dropdown-item.selected").forEach((item) => item.classList.remove("selected"));

          const valueId = item.getAttribute("data-value");
          const value = item.textContent;

          item.classList.add("selected");
          if (dropdownInput) {
            console.log("Dropdown input found");
            dropdownInput.value = value;
            dropdownInput.setAttribute("data-value", valueId);
          } else if (dropdownBtn) {
            console.log("Dropdown button found");
            dropdownBtn.textContent = value;
            dropdownBtn.setAttribute("data-value", valueId);
          } else {
            console.log("[ERROR]: No dropdown input or button found\n [DEBUG]: " + createIndexedPathTo(dropdown));
          }

          // Close the dropdown
          dropdownMenu.classList.remove("show");
        });
      });
    });
  });
});