class request {
  /**
   * Construct the HTTP request
   * @param {Object} options The HTTP requests options
   * @param {string} options.method The method of the HTTP request
   * @param {string} options.url The URL to send a HTTP request to
   * @param {number} options.timeout The timeout of the HTTP request
   * @param {Object} options.body The body of the HTTP request
   * @param {Object} options.headers The HTTP requests headers
   * @param {(data: Object) => void} options.callback Returns the HTTP request
   * @param {(data: Object) => void} options.success Returns the HTTP request only if the request was successful
   * @param {(data: Object) => void} options.error Returns the HTTP request only if the request was not successful
   * @example new request({ method: "POST", url: "https://example.com/api/example", body: { value: "Hello from JavaScript" } }).send();
  */
  constructor(options = { method: "GET", url: "", timeout: 60000, body: {}, headers: {}, callback: null, success: null, error: null }) {
    if (options) {
      if (typeof options.method == "string" && options.method !== "")
        this.method = (options.method).toUpperCase();
      if (typeof options.url == "string" && options.url !== "")
        this.url = options.url;
      if ((typeof options.body == "string" && options.body !== "") || typeof options.body == "object")
        this.body = options.body;
      if (typeof options.callback == "function")
        this.callback = options.callback;
      if (typeof options.success == "function")
        this.successCallback = options.success;
      if (typeof options.error == "function")
        this.errorCallback = options.error;
      if (typeof options.headers == "object")
        this.headers = options.headers;

      this.timeout = typeof options.timeout === "number" ? options.timeout : 60000;
    }
  }

  /**
   * Convert JSON data to strings to be parsed by the backend
   * @param {string | object} body The body to parse
   * @example new request(...).parseBody({ placeholder: true });
   */
  parseBody(body) {
    if (typeof body == "string")
      return body;
    else if (typeof body == "object") {
      let body1 = [];
      Object.keys(body).forEach((key, index) => {
        body1.push(`${key}=${body[key]}`);
      });
      return body1.join("&");
    }
    return "";
  }

  /**
   * Set the body to send
   * @param {object} body The body of the HTTP request
   * @example let req = new request(...);
   * @example req.setBody({ value: "Hello from JavaScript" });
   * @example req.send();
  */
  setBody(body) {
    if (typeof body == "string" || typeof body == "object")
      this.body = body;
    else
      throw new TypeError("Typeof body must be object, received: " + typeof body);

    return this;
  }

  /**
   * Set the method of the HTTP request
   * @param {String} method The method of the HTTP request
   * @example let req = new request(...);
   * @example req.setMethod("POST");
   * @example req.send();
  */
  setMethod(method) {
    if (typeof method == "string")
      this.method = (method).toUpperCase();
    else
      throw new TypeError("Typeof method must be string, received: " + typeof method);

    return this;
  }

  /**
   * Set the URL for the HTTP request
   * @param {String} URL The URL for the HTTP request
   * @example let req = new request(...);
   * @example req.setURL("https://example.com/api/example");
   * @example req.send();
  */
  setURL(URL) {
    if (typeof URL == "string")
      this.url = URL;
    else
      throw new TypeError("Typeof URL must be string, received: " + typeof URL);

    return this;
  }

  /**
   * Set headers for the HTTP request
   * @param {Object} headers The headers for the HTTP request
   * @example let req = new request(...);
   * @example req.setHeaders({ "Content-Length": length });
   * @example req.send();
  */
  setHeaders(headers) {
    if (typeof headers === "object")
      this.headers = { ...this.headers, headers };
    else
      throw new TypeError("Typeof headers must be object, received: " + typeof headers);

    return this;
  }

  /**
   * Send the HTTP request
   * @param {?boolean} parseBody If the body should be parsed before sent
   * @param {?boolean} isJSON If the request body should be sent as JSON
   * @example new request(...).send(true);
  */
  send(parseBody=true, isJSON=true) {
    if (typeof this.url !== "string" || (this.url).length < 4)
      throw new Error("A valid URL must be provided to send the request");
    if (!window.XMLHttpRequest)
      throw new Error("Your browser is outdated and is unable to preform required actions");

    if (typeof this.method !== "string" || (this.method).length < 2)
      this.method = "GET";
    if (this.method !== (this.method).toUpperCase())
      this.method = (this.method).toUpperCase();

    if ((this.url).startsWith("/"))
      this.url = `${window.location.protocol}//${window.location.host}${this.url}`;
    else if (!(this.url).startsWith("/") && !(this.url).startsWith("http"))
      this.url = `${window.location.protocol}//${window.location.host}/${this.url}`;

    let xml = new XMLHttpRequest();
    xml.open(this.method, this.url);
    if (this.headers) {
      Object.keys(this.headers).forEach(key => {
        xml.setRequestHeader(key, this.headers[key]);
      });
    }
    xml.timeout = this.timeout;

    if ((!this.headers && isJSON) || (this.headers && isJSON && (!this.headers["Content-Type"] && this.body))) {
      xml.setRequestHeader("Content-Type", "application/json");
    } else if (!this.headers || (!this.headers["Content-Type"] && this.body)) {
      xml.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    }
    
    // Parse the body
    if (isJSON && parseBody === false && this.body) {
      xml.send(this.body);
    } else if (isJSON && this.body) {
      xml.send(typeof this.body === "string" ? this.body : JSON.stringify(this.body));
    } else if (parseBody === false && this.body) {
      xml.send(this.body);
    }else if (this.body) {
      xml.send(this.parseBody(this.body));
    } else {
      xml.send();
    }

    let callback = this.callback;
    let successCallback = this.successCallback;
    let errorCallback = this.errorCallback;

    // Success function
    xml.onload = function() {
      // Define the data
      let data = {
        status: this.status,
        statusText: this.statusText,
        data: this.responseText,
        response: {
          data: this.responseText,
          type: this.responseType,
          URL: this.responseURL,
          headers: this.getAllResponseHeaders()
        }
      }
      // Define an error in the data if there is one
      !(this.status).toString().startsWith("2")
        ? data.error = this.statusText
        : null;

      let contentTypeHeader = this.getResponseHeader("Content-Type");
      if (contentTypeHeader) {
        data.response.contentType = contentTypeHeader;

        if (contentTypeHeader.includes("application/json")) {
          data.rawData = this.responseText;
          data.data = JSON.parse(this.responseText);
        }
      }

      // Return the callback
      if (typeof callback == "function") {
        callback(data);
      }
      if ((this.status).toString().startsWith("2") && typeof successCallback == "function") { // Success code & success-callback is a function
        successCallback(data);
      } else if (!(this.status).toString().startsWith("2") && typeof errorCallback == "function") { // Error code & error-callback function is a function
        errorCallback(data);
      }
      return;
    }
    // Timeout function
    xml.ontimeout = function() {
      let data = {
        status: 408,
        error: "Request Timeout",
        data: null,
        response: {
          data: null,
          type: null,
          URL: null
        }
      }
      if (typeof errorCallback == "function")
        errorCallback(data);
      if (typeof callback == "function")
        callback(data);
    }
    // Error function
    xml.onerror = function() {
      let data = {
        status: 503,
        error: "Service Unavailable",
        data: null,
        response: {
          data: null,
          type: null,
          URL: null
        }
      }

      if (typeof errorCallback == "function")
        errorCallback(data);
      if (typeof callback == "function")
        callback(data);
    }
  }

  /**
   * Called when the HTTP request was successful
   * @param {(data: Object) => void} callback Returns the HTTP request
   * @example let req = new request(...);
   * @example req.send();
   * @example req.success(() => console.log("success"));
  */
  success(callback) {
    if (typeof callback == "function")
      this.successCallback = callback;
    else
      throw new TypeError("Callback function must be of type function, received: " + typeof callback);
  }
  /**
   * Called when an error occurred whilst sending the HTTP request
   * @param {(data: Object) => void} callback Returns the HTTP request
   * @example let req = new request(...);
   * @example req.send();
   * @example req.error(() => console.log("success"));
  */
  error(callback) {
    if (typeof callback == "function")
      this.errorCallback = callback;
    else
      throw new TypeError("Callback function must be of type function, received: " + typeof callback);
  }
}
if (!window.request)
  window.request = request;

const cookie = {
  get: (name) => {
    let c = document.cookie.match(`(?:(?:^|.*; *)${name} *= *([^;]*).*$)|^.*$`)[1];
    if (c) return decodeURIComponent(c);
  },
  set: (name, value, opts = { days: 30, path: "/" }) => {
    // If options contains days then we're configuring max-age
    if (opts.days) {
      opts["max-age"] = opts.days * 60 * 60 * 24;

      // Deleting days from options to pass remaining opts to cookie settings
      delete opts.days;
    }

    // Configuring options to cookie standard by reducing each property
    opts = Object.entries(opts).reduce(
      (accumulatedStr, [k, v]) => `${accumulatedStr}; ${k}=${v}`, ""
    );

    // Finally, creating the key
    document.cookie = name + "=" + encodeURIComponent(value) + opts;
  },
  delete: (name, opts) => cookie.set(name, "", { "max-age": -1, ...opts })
}
this.cookies = cookie;

this.cache = {};

/**
 * Create a string path to an element
 * @param {Node} node The document node
 * @returns {string} The path
 */
function createIndexedPathTo(node) {
  var path = [];
  while (node.tagName.toLowerCase() !== "body") {
    var selector = node.tagName.toLowerCase();
    if (node.id) {
      selector = "#" + node.id;
    } else if (node.className) {
      selector += "." + node.className.split(" ").join(".");
    }
    if (node.hasAttribute("page")) {
      selector += "[page=\"" + node.getAttribute("page") + "\"]";
    }
    path.unshift(selector);
    node = node.parentNode;
  }
  return path.join(" > ");
}