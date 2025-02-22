document.addEventListener("DOMContentLoaded", function(event) {
  // Ensure the event is trusted
  if (!event.isTrusted) return;

  const resetPasswordForm = document.getElementById("reset-password-form");

  function toggleBtnLoadingStatus(status) {
    let btn = resetPasswordForm.querySelector("button[type=submit]");

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

  const showPasswordBtns = resetPasswordForm.querySelectorAll(".form-group .input-wrapper button.show-password-btn");

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

  resetPasswordForm.addEventListener("submit", function(event) {
    // Ensure the event is trusted
    if (!event.isTrusted) return;

    // Display a loading symbol
    toggleBtnLoadingStatus("visible");

    event.preventDefault();
    event.stopPropagation();

    // Define values
    let passwordInput = document.getElementById("new-password-input")?.value;
    let repeatPasswordInput = document.getElementById("repeat-password-input")?.value;

    // Define error message templates
    const passwordError = resetPasswordForm.querySelector("div.form-group > p.small-text[data-labelledby=password-input]");
    const repeatPasswordError = resetPasswordForm.querySelector("div.form-group > p.small-text[data-labelledby=repeat-password-input]");
    const generalError = resetPasswordForm.querySelector("div.form-group > p.small-text[data-labelledby=general-error]");

    let errorExists = false;

    if (passwordError)
      passwordError.classList.add("hidden", "error");
    if (repeatPasswordError)
      repeatPasswordError.classList.add("hidden", "error");
    if (generalError)
      generalError.classList.add("hidden", "error");

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
      url: "/api/v1/account/reset-password",
      body: {
        password: passwordInput
      },
      headers: {
        "Authorization": `Bearer ${cookie.get("auth")}`
      },
      callback: function() {
        // Remove the loading symbol
        toggleBtnLoadingStatus("hidden");
      },
      success: function() {
        generalError.classList.remove("hidden", "error");
        generalError.classList.add("success");
        generalError.textContent = "Password reset successfully";

        window.location.href = "/";
      },
      error: function(response) {
        let code = response.data?.code;

        generalError.classList.remove("hidden", "success");
        generalError.classList.add("error");

        if (code === 4303) {
          generalError.textContent = `${response.data?.error || "Password doesn't meet minimum requirements"} (Code: 4303)`;
        } else if (code === 4005) {
          generalError.textContent = `${response.data?.error || "Password doesn't meet length requirements"} (Code: 4005)`;
        } else if (code === 5002) {
          generalError.textContent = "Too many requests, please try again later (Code: 5002)";
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