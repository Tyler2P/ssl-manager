document.addEventListener("DOMContentLoaded", function(event) {
  // Ensure the event is trusted
  if (!event.isTrusted) return;

  const createAccountForm = document.getElementById("create-account-form");

  function toggleBtnLoadingStatus(status) {
    let btn = createAccountForm.querySelector("button[type=submit]");

    if (status === "visible") {
      btn.classList.add("btn-loading");
      btn.setAttribute("disabled", "true");
      btn.setAttribute("aria-disabled", "true");
    } else if (status === "hidden") {
      btn.classList.remove("btn-loading");
      btn.removeAttribute("disabled");
      btn.removeAttribute("aria-disabled");
    } else {
      if (btn.classList.contains("btn-loading")) {
        btn.classList.remove("btn-loading");
        btn.removeAttribute("disabled");
        btn.removeAttribute("aria-disabled");
      } else {
        btn.classList.add("btn-loading");
        btn.setAttribute("disabled", "true");
        btn.setAttribute("aria-disabled", "true");
      }
    }
  }

  const showPasswordBtns = createAccountForm.querySelectorAll(".form-group .input-wrapper button.show-password-btn");

  if (showPasswordBtns.length > 0) {
    showPasswordBtns.forEach((showPasswordBtn) => {
      showPasswordBtn.addEventListener("click", function() {
        const passwordInput = showPasswordBtn.parentElement.querySelector("input");
        const icon = showPasswordBtn.querySelector("i");

        if (!passwordInput) return;

        if (passwordInput.getAttribute("type") === "password") {
          passwordInput.setAttribute("type", "text");
          icon.classList.remove("fa-eye");
          icon.classList.add("fa-eye-slash");
        } else {
          passwordInput.setAttribute("type", "password");
          icon.classList.remove("fa-eye-slash");
          icon.classList.add("fa-eye");
        }
      });
    });
  }

  createAccountForm.addEventListener("submit", function(event) {
    // Ensure the event is trusted
    if (!event.isTrusted) return;

    // Display a loading symbol
    toggleBtnLoadingStatus("visible");

    event.preventDefault();
    event.stopPropagation();
    
    // Define values
    let usernameInput = document.getElementById("username-input")?.value;
    let passwordInput = document.getElementById("password-input")?.value;
    let repeatPasswordInput = document.getElementById("repeat-password-input")?.value;

    // Define error message templates
    const usernameError = createAccountForm.querySelector("div.form-group > p.small-text[data-labelledby=username-input]");
    const passwordError = createAccountForm.querySelector("div.form-group > p.small-text[data-labelledby=password-input]");
    const repeatPasswordError = createAccountForm.querySelector("div.form-group > p.small-text[data-labelledby=repeat-password-input]");
    const generalError = createAccountForm.querySelector("div.form-group > p.small-text[data-labelledby=general-error]");

    let errorExists = false;

    if (usernameError)
      usernameError.classList.add("hidden", "error");
    if (passwordError)
      passwordError.classList.add("hidden", "error");
    if (repeatPasswordError)
      repeatPasswordError.classList.add("hidden", "error");
    if (generalError)
      generalError.classList.add("hidden", "error");

    if (!usernameInput || ["", " "].includes(usernameInput)) {
      usernameError.textContent = "This field is required";
      usernameError.classList.remove("hidden");
      errorExists = true;
    }
    if (!passwordInput || ["", " "].includes(passwordInput)) {
      passwordError.textContent = "This field is required";
      passwordError.classList.remove("hidden");
      errorExists = true;
    }
    if (!repeatPasswordInput || ["", " "].includes(repeatPasswordInput)) {
      repeatPasswordError.textContent = "This field is required";
      repeatPasswordError.classList.remove("hidden");
      errorExists = true;
    }

    // Ensure an error isn't present
    if (errorExists) return toggleBtnLoadingStatus("hidden");

    usernameInput = usernameInput.trim();
    
    if (usernameInput.length < 2 || usernameInput.length > 320) {
      usernameError.textContent = "A valid username must be provided";
      usernameError.classList.remove("hidden");
      errorExists = true;
    }
    if (passwordInput < 2 || passwordInput > 256) {
      passwordError.textContent = "A valid password must be provided";
      passwordError.classList.remove("hidden");
      errorExists = true;
    }
    // Ensure both passwords match
    if (repeatPasswordInput !== passwordInput) {
      repeatPasswordError.textContent = "Passwords don't match";
      repeatPasswordError.classList.remove("hidden");
      errorExists = true;
    }

    // Ensure an error isn't present
    if (errorExists) return toggleBtnLoadingStatus("hidden");

    new request({
      method: "POST",
      url: "/api/v1/first-setup/create-account",
      body: {
        username: usernameInput,
        password: passwordInput
      },
      callback: function() {
        // Remove the loading symbol
        toggleBtnLoadingStatus("hidden");
      },
      success: function() {
        generalError.classList.remove("hidden", "error");
        generalError.classList.add("success");
        generalError.textContent = "Account created successfully";

        window.location.href = "/";
      },
      error: function(response) {
        let code = response.data?.code;

        generalError.classList.remove("hidden", "success");
        generalError.classList.add("error");

        if (code == 4015 && Array.isArray(response.data?.errors)) {
          (response.data?.errors).forEach((error) => {
            if (!error?.type) return console.log("[ERROR]: Unexpected data returned from API endpoint (Code: 6008)\n[DEBUG]: API Error code 4015 'error.type' not present");
            let errorMsg = createAccountForm.querySelector(`div.form-group > p.small-text[data-labelledby=${error.type}-input]`);
            if (errorMsg) {
              errorMsg.classList.remove("hidden");
              errorMsg.textContent = error.error;
            } else
              console.log("[ERROR]: HTML element cannot be found (Code: 6001)\n" + `[DEBUG]: div.form-group > p.small-text[data-labelledby=${error.type}-input] (Code: 6001)`);
          });
        } else if (code === 4201) {
          generalError.textContent = "Username or password incorrect (Code: 4201)";
        } else if (code === 5002) {
          generalError.textContent = "Too many requests, please try again later (Code: 5002)";
        } else if (code === 5008) {
          generalError.textContent = "This site has already been setup. If you have forgotten a local account's password, please refer to the official documentation (Code: 5008)";
        } else if (response?.status === 408 || code === 4014) {
          generalError.textContent = "Request timeout, please try again later (Code: 4014)";
        } else if (response?.status === 503 || code === 6007) {
          generalError.textContent = "Unable to connect to the server, please try again later (Code: 6007)";
        } else {
          generalError.textContent = `Something went wrong, please try again later (Code: ${response.data?.code || "0000"})`;
        }
      }
    }).send(true, true);
  });
});