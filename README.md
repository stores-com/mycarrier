# MyCarrier

A Node.js client for MyCarrier LTL freight rates and saved shipping locations.

```sh
npm install github:stores-com/my-carrier#ca5d490cc2e48300534b3bd7f5248ae640a8f21d
```

The initial release is available from GitHub. The command above pins the tested client commit; npm registry publication is pending. Once published, install with `npm install my-carrier`.

## Usage

```js
const MyCarrier = require('my-carrier');

const myCarrier = new MyCarrier({
    api_key: process.env.MYCARRIER_API_KEY
});

const response = await myCarrier.getShippingLocations({ take: 50 });
const shippingLocations = response.data.shippingLocations;
```

The client uses CommonJS, native `fetch`, promises, carrier-native request and response objects, and `@stores.com/http-error` errors. Node.js 18 or later is required.

## Authentication and configuration

Supply the API key issued for your MyCarrier account as `api_key`. Each request sends it in `X-Mc-Api-Key`. No email, Basic authentication, Bearer prefix, token exchange, or token cache is used. The library does not read environment variables itself; the example above passes the key explicitly.

| Option | Default | Description |
| --- | --- | --- |
| `api_key` | Required from the caller | MyCarrier API key |
| `url` | `https://api.mycarriertms.com` | API base URL, without `/api/v1` |
| `timeout` | `60000` | Request timeout in milliseconds |

Every method accepts a final options object with a `timeout` override. Requests are made once; retry and caching policies belong to the application.

## Methods

### `getShippingLocations(query = {}, options = {})`

Calls `GET /api/v1/address/shipping-locations`. Query parameters are URL encoded and forwarded to the API. The entire JSON response is returned, including `data.shippingLocations`. Pagination is explicit: this method makes one request and does not automatically fetch subsequent pages.

```js
const response = await myCarrier.getShippingLocations({ take: 50 }, { timeout: 15000 });
```

### `getRates(request, options = {})`

Calls `POST /api/v1/quote/rate`. Pass a rate request in MyCarrier's own schema; the library serializes it without adding account, address, payment, freight-class, or shipment defaults. The entire JSON response is returned, including `data.rates` and `data.statusInfo`.

```js
// rateRequest is a MyCarrier request containing your stops and shipping details.
const response = await myCarrier.getRates({
    ...rateRequest,
    action: 'RATE_ONLY'
}, { timeout: 90000 });

const rates = response.data.rates;
```

Use `RATE_ONLY` for estimates. The API also supports actions that save quotes; this client forwards the action supplied by the caller. Applications should inspect each rate's `statusInfo`: a rate may contain a price and still report an error. Account configuration, contacts, and supported payment terms can affect which carriers return rates.

This initial release covers these two endpoints. Shipment booking, cancellation, documents, and tracking are not implemented.

## Errors

Every non-2xx response throws an [`HttpError`](https://github.com/stores-com/http-error), including HTTP 400. It retains:

- `error.cause.status`: HTTP status code.
- `error.json`: parsed response body, when the body is valid JSON.
- `error.text`: original response body, when available.

MyCarrier can return HTTP 400 with useful carrier decline reasons or validation details. Applications can inspect those details without losing the HTTP failure status:

```js
try {
    const response = await myCarrier.getRates(rateRequest);
    // Use response.data.rates.
} catch (error) {
    if (error.cause?.status === 400 && error.json) {
        // Inspect error.json.data?.statusInfo and error.json.data?.rates.
    } else {
        throw error;
    }
}
```

Network failures, timeouts, and invalid JSON in successful responses propagate as native errors. An HTTP success does not imply that every individual rate succeeded; carrier status objects are returned unchanged.

## Development

```sh
npm install
npm run lint
npm test
npm run test:coverage
npm pack --dry-run
```

Use Node.js 24 for development tooling. The tests use synthetic responses and require no account credentials or live carrier requests. CI runs lint on Node.js 24 and tests across Node.js 18, 20, 22, and 24. The npm package contains only the client, package metadata, README, license, and changelog.

The manual Publish workflow runs lint and tests on the checked-out `main` commit before publishing with provenance and creating a GitHub release. Configure npm publishing authorization for the repository before running it.

## License

MIT © Stores.com
