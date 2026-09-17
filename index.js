const HttpError = require('@stores.com/http-error');

/**
 * Return the API response unchanged, preserving unsuccessful response bodies on HttpError.
 *
 * @private
 * @param {Response} response - A fetch response.
 * @returns {Promise<Object>} The parsed JSON response.
 * @throws {HttpError} If the response has a non-success HTTP status.
 */
async function parseResponse(response) {
    if (!response.ok) {
        throw await HttpError.from(response);
    }

    return await response.json();
}

/**
 * A client for the MyCarrier API.
 *
 * @param {Object} args - Client options.
 * @param {string} args.api_key - MyCarrier API key, sent in the X-Mc-Api-Key header.
 * @param {number} [args.timeout=60000] - Request timeout in milliseconds.
 * @param {string} [args.url='https://api.mycarriertms.com'] - API base URL.
 * @example
 * const myCarrier = new MyCarrier({ api_key: process.env.MYCARRIER_API_KEY });
 */
function MyCarrier(args) {
    const _options = Object.assign({
        timeout: 60000,
        url: 'https://api.mycarriertms.com'
    }, args);

    const baseUrl = _options.url.replace(/\/+$/, '');

    /**
     * Get saved shipping locations for the account.
     *
     * @param {Object} [query] - Query parameters passed to the API, such as take.
     * @param {Object} [options] - Per-call options.
     * @param {number} [options.timeout] - Override the client timeout in milliseconds.
     * @returns {Promise<Object>} The full response, including data.shippingLocations.
     * @throws {HttpError} If the response has a non-success HTTP status.
     * @example
     * const response = await myCarrier.getShippingLocations({ take: 50 });
     */
    this.getShippingLocations = async function(query = {}, options = {}) {
        let url = `${baseUrl}/api/v1/address/shipping-locations`;
        const queryString = new URLSearchParams(query).toString();

        if (queryString) {
            url += `?${queryString}`;
        }

        const response = await fetch(url, {
            headers: {
                'X-Mc-Api-Key': _options.api_key
            },
            signal: AbortSignal.timeout(options.timeout ?? _options.timeout)
        });

        return await parseResponse(response);
    };

    /**
     * Request freight rates using a MyCarrier rate request.
     *
     * The request is forwarded unchanged. Use action: 'RATE_ONLY' to request an
     * estimate without saving a quote. Inspect the statusInfo on individual rates,
     * since a priced rate can still have an Error status.
     *
     * @param {Object} request - The carrier's rate request.
     * @param {Object} [options] - Per-call options.
     * @param {number} [options.timeout] - Override the client timeout in milliseconds.
     * @returns {Promise<Object>} The full response, including data.rates and data.statusInfo.
     * @throws {HttpError} For non-success HTTP statuses, including 400; error.json preserves carrier diagnostics.
     * @example
     * const response = await myCarrier.getRates(request, { timeout: 90000 });
     */
    this.getRates = async function(request, options = {}) {
        const response = await fetch(`${baseUrl}/api/v1/quote/rate`, {
            body: JSON.stringify(request),
            headers: {
                'Content-Type': 'application/json',
                'X-Mc-Api-Key': _options.api_key
            },
            method: 'POST',
            signal: AbortSignal.timeout(options.timeout ?? _options.timeout)
        });

        return await parseResponse(response);
    };
}

module.exports = MyCarrier;
