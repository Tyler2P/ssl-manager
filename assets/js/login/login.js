document.addEventListener("DOMContentLoaded", function(event) {
  // Ensure the event is trusted
  if (!event.isTrusted) return;

  function toggleBtnLoadingStatus(status) {
    let btn = loginForm.querySelector("button[type=submit]");

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

  const loginForm = document.getElementById("login-form");
  const showPasswordBtn = loginForm.querySelector(".form-group .input-wrapper button.show-password-btn");

  if (showPasswordBtn) {
    showPasswordBtn.addEventListener("click", function() {
      const passwordInput = document.getElementById("password-input");
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
  }

  loginForm.addEventListener("submit", function(event) {
    // Ensure the event is trusted
    if (!event.isTrusted) return;

    // Display a loading symbol
    toggleBtnLoadingStatus("visible");

    event.preventDefault();
    event.stopPropagation();
    
    // Define values
    let usernameInput = document.getElementById("username-input")?.value;
    let passwordInput = document.getElementById("password-input")?.value;

    // Define error message templates
    const usernameError = loginForm.querySelector("div.form-group > p.small-text[data-labelledby=username-input]");
    const passwordError = loginForm.querySelector("div.form-group > p.small-text[data-labelledby=password-input]");
    const generalError = loginForm.querySelector("div.form-group > p.small-text[data-labelledby=general-error]");

    let errorExists = false;

    if (usernameError)
      usernameError.classList.add("hidden", "error");
    if (passwordError)
      passwordError.classList.add("hidden", "error");
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

    // Ensure an error isn't present
    if (errorExists) return toggleBtnLoadingStatus("hidden");

    new request({
      method: "POST",
      url: "/api/v1/login/validate",
      body: {
        username: usernameInput,
        password: passwordInput
      },
      callback: function() {
        console.log("request callback");
        // Remove the loading symbol
        toggleBtnLoadingStatus("hidden");
      },
      success: function(response) {
        console.log("request success");
        let search = new URLSearchParams(window.location.search);
        const code = response?.data?.code;

        if (code === 2201) { // Account details correct, 2FA required
          // If the user auth doesn't exist, display an error
          if (!response?.data?.userAuth) {
            generalError.textContent = `Something went wrong, please try again later (Code: ${response.data?.code || "6004"})`;
            generalError.classList.remove("hidden");
            return;
          }

          // Set required search params
          search.append("username", encodeURIComponent(usernameInput));
          search.append("token", encodeURIComponent(response.data.userAuth));

          // Redirect users to the next stage of the login process
          window.location.href = `/auth/login/mfa?${search.toString()}`;
        } else if (code === 2202) { // Account details correct, manual account alteration required
          // If the user auth doesn't exist, display an error
          if (!response?.data?.userAuth) {
            generalError.textContent = `Something went wrong, please try again later (Code: ${response.data?.code || "6004"})`;
            generalError.classList.remove("hidden");
            return;
          }

          cookie.set("auth", response.data.userAuth, { sameSite: "strict", path: "/" });

          // Redirect users to the next stage of the login process
          window.location.href = `/auth/login/alterations?${search.toString()}`;
        } else if (code === 2203) { // User fully authenticated
          // If the user auth doesn't exist, display an error
          if (!response?.data?.userAuth) {
            generalError.textContent = `Something went wrong, please try again later (Code: ${response.data?.code || "6004"})`;
            generalError.classList.remove("hidden");
            return;
          }

          cookie.set("auth", response.data.userAuth, { sameSite: "strict", path: "/" });

          // Redirect the user to the page they were attempting to access
          window.location.href = search.get("redirect") || "/dashboard";
        } else {
          generalError.textContent = `Something went wrong, please try again later (Code: ${response.data?.code || "6008"})`;
          generalError.classList.remove("hidden");
        }
      },
      error: function(response) {
        console.log("request error");
        let code = response.data?.code;

        generalError.classList.remove("hidden");

        if (code === 4201 || code === 4011) {
          generalError.textContent = "Username or password incorrect (Code: 4201)";
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