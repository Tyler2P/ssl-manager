document.addEventListener("DOMContentLoaded", function(event) {
  if (!event.isTrusted) return;

  //- Handle the new certificate modal
  const createCertModal = document.getElementById("new-certificate-modal");
  const createCertModal_form = document.getElementById("new-certificate-form");
  const createCertModal_closeBtn = createCertModal.querySelector(".modal-content > button.close-btn");
  const createCertModal_cancelBtn = createCertModal.querySelector("#new-certificate-form > button[data-action=cancel]");
  const createCertModal_createBtn = createCertModal.querySelector("#new-certificate-form > button[data-action=create]");

  createCertModal.addEventListener("click", function(event) {
    let target = event.target;
    // Ensure the user didn't click on the modal-dialog
    while (target && target !== document) {
      if (target.matches(`#new-certificate-modal .modal-dialog`)) {
        return;
      }
      target = target.parentNode;
    }
    createCertModal.classList.remove("show");
    createCertModal.setAttribute("tabindex", "-1");
    createCertModal.setAttribute("aria-hidden", "true");
  });
  [createCertModal_closeBtn, createCertModal_cancelBtn].forEach((elem) => {
    elem.addEventListener("click", function() {
      createCertModal.classList.remove("show");
      createCertModal.setAttribute("tabindex", "-1");
      createCertModal.setAttribute("aria-hidden", "true");
    });
  });
  createCertModal_form.addEventListener("submit", function(event) {
    event.preventDefault();

    // Ensure that the button isn't already loading
    if (createCertModal_createBtn.classList.contains("btn-loading")) return;
    // Add loading state to button
    createCertModal_createBtn.classList.add("btn-loading");

    // Get form values
    const name = document.getElementById("cert-name-input")?.value;
    const description = document.getElementById("cert-description-input")?.value;
    let type = document.getElementById("select[name=type]")?.value;
    const domainsWrapper = document.getElementById("cert-domains-inputs");
    const dns_profile = document.getElementById("select[name=dns_profile]")?.value;
    const generalError = createCertModal_form.querySelector("p.small-text[data-labelledby=cert-create-error]");

    // Validate form values
    if (name.length < 3 || name.length > 255) {
      let errorMsg = createCertModal_form.querySelector("p.small-text[data-labelledby=cert-name-input]");
      errorMsg.textContent = "Invalid name provided";
      errorMsg.classList.add("error");
      errorMsg.classList.remove("hidden", "success");
      createCertModal_createBtn.classList.remove("btn-loading");
      return;
    }
    if ((description && !["", " "].includes(description.trim())) && (description.length < 3 || description.length > 255)) {
      let errorMsg = createCertModal_form.querySelector("p.small-text[data-labelledby=cert-description-input]");
      errorMsg.textContent = "Invalid description provided";
      errorMsg.classList.add("error");
      errorMsg.classList.remove("hidden", "success");
      createCertModal_createBtn.classList.remove("btn-loading");
      return;
    }
    if (type !== "staging" && type !== "production") {
      type = null;
    }
  
    // Find domains
    let domainsElem = domainsWrapper.querySelectorAll(".domain-wrapper > input");
    domains = Array.from(domainsElem).map((elem) => elem.value);
    if (domains.length < 1) {
      let errorMsg = createCertModal_form.querySelector("p.small-text[data-labelledby=cert-domains-inputs]");
      errorMsg.textContent = "At least 1 valid domain must be provided";
      errorMsg.classList.add("error");
      errorMsg.classList.remove("hidden", "success");
      createCertModal_createBtn.classList.remove("btn-loading");
      return;
    } else if (domains.length > 40) {
      let errorMsg = createCertModal_form.querySelector("p.small-text[data-labelledby=cert-domains-inputs]");
      errorMsg.textContent = "A maximum of 40 domains can be provided";
      errorMsg.classList.add("error");
      errorMsg.classList.remove("hidden", "success");
      createCertModal_createBtn.classList.remove("btn-loading");
      return;
    }

    // Send request
    new request({
      method: "POST",
      url: "/api/v1/certificates/create",
      headers: {
        "Authorization": "Bearer " + cookies.get("auth")
      },
      body: {
        name,
        description,
        type,
        domains,
        dns_profile
      },
      callback: function() {
        createCertModal_createBtn.classList.remove("btn-loading");
      },
      success: function(response) {
        if (response.status === 200) {
          createCertModal.classList.remove("show");
          createCertModal.setAttribute("tabindex", "-1");
          createCertModal.setAttribute("aria-hidden", "true");
        }
      },
      error: function(response) {
        let code = response.data?.code;

        if (code == 4015 && Array.isArray(response.data?.errors)) {
          (response.data?.errors).forEach((error) => {
            if (!error?.type) return console.log("[ERROR]: Unexpected data returned from API endpoint (Code: 6008)\n[DEBUG]: API Error code 4015 'error.type' not present");
            let errorMsg = createCertModal_form.querySelector(`div.form-group > p.small-text[data-labelledby=cert-${error.type}-input]`);
            if (errorMsg) {
              errorMsg.classList.remove("hidden");
              errorMsg.textContent = error.error;
            } else
              console.log("[ERROR]: HTML element cannot be found (Code: 6001)\n" + `[DEBUG]: div.form-group > p.small-text[data-labelledby=cert-${error.type}-input] (Code: 6001)`);
          });
        } else if (code === 4201) {
          generalError.classList.remove("hidden", "success");
          generalError.classList.add("error");
          generalError.textContent = "Username or password incorrect (Code: 4201)";
        } else if (code === 5002) {
          generalError.classList.remove("hidden", "success");
          generalError.classList.add("error");
          generalError.textContent = "Too many requests, please try again later (Code: 5002)";
        } else if (code === 5008) {
          generalError.classList.remove("hidden", "success");
          generalError.classList.add("error");
          generalError.textContent = "This site has already been setup. If you have forgotten a local account's password, please refer to the official documentation (Code: 5008)";
        } else if (response?.status === 408 || code === 4014) {
          generalError.classList.remove("hidden", "success");
          generalError.classList.add("error");
          generalError.textContent = "Request timeout, please try again later (Code: 4014)";
        } else if (response?.status === 503 || code === 6007) {
          generalError.classList.remove("hidden", "success");
          generalError.classList.add("error");
          generalError.textContent = "Unable to connect to the server, please try again later (Code: 6007)";
        } else {
          generalError.classList.remove("hidden", "success");
          generalError.classList.add("error");
          generalError.textContent = `Something went wrong, please try again later (Code: ${response.data?.code || "0000"})`;
        }
      }
    }).send(true, true);
  });


  //- Handle main page functionality

  const certsHeader = document.querySelector("body > .page > .wrapper > .cert-header");
  const createCertHeaderBtn = certsHeader.querySelector("button[data-action=create-cert]");
  const renewAllCertHeaderBtn = certsHeader.querySelector("button[data-action=renew-all-cert]");
  const errorCreateCertBtn = document.getElementById("error-create-cert-btn");

  if (errorCreateCertBtn instanceof HTMLButtonElement) {
    errorCreateCertBtn.addEventListener("click", function() {
      createCertModal.classList.add("show");
      createCertModal.setAttribute("tabindex", "5");
      createCertModal.setAttribute("aria-hidden", "false");
    });
  }
  createCertHeaderBtn.addEventListener("click", function() {
    createCertModal.classList.add("show");
    createCertModal.setAttribute("tabindex", "5");
    createCertModal.setAttribute("aria-hidden", "false");
  });
  renewAllCertHeaderBtn.addEventListener("click", function() {
    renewAllCertHeaderBtn.classList.add("btn-loading");

    new request({
      method: "POST",
      url: "/api/v1/certificates/renew/all",
      header: {
        "Authorization": "Bearer " + cookies.get("auth")
      },
      callback: function() {
        renewAllCertHeaderBtn.classList.remove("btn-loading");
      }
    }).send(false, false);
  });
});