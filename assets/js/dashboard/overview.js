document.addEventListener("DOMContentLoaded", function(event) {
  if (!event.isTrusted) return;

  const createCertModal = document.getElementById("new-certificate-modal");
  const createCertModal_form = document.getElementById("new-certificate-form");
  const createCertModal_closeBtn = createCertModal.querySelector(".modal-content > button.close-btn");
  const createCertModal_cancelBtn = createCertModal.querySelector("#new-certificate-form > button[data-action=cancel]");
  const createCertModal_createBtn = createCertModal.querySelector("#new-certificate-form > button[data-action=create]");

  const certsHeader = document.querySelector("body > .page > .wrapper > .cert-header");
  const createCertHeaderBtn = certsHeader.querySelector("button[data-action=create-cert]");
  const renewAllCertHeaderBtn = certsHeader.querySelector("button[data-action=renew-all-cert]");
  const errorCreateCertBtn = document.getElementById("error-create-cert-btn");

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
    createCertModal_createBtn.classList.add("btn-loading");

    // Get form values
    let name = document.getElementById("cert-name-input").value;
    let description = document.getElementById("cert-description-input").value;
    let type = document.getElementById("select[name=type]").value;
    let domains = document.getElementById("cert-domains-inputs");
    let dns_profile = document.getElementById("select[name=dns_profile]").value;

    new request({
      method: "POST",
      url: "/api/v1/certificates/create",
      header: {
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
      }
    }).send(false);
  });

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