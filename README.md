# MyCarrier

A Node.js client for MyCarrier LTL freight rates, saved shipping locations, and shipment details.

Official documentation: [MyCarrier Developer Guide](https://developer.mycarrier.io/docs/getting-started) · [MyCarrier API Reference](https://developer.mycarrier.io/reference).

```sh
npm install mycarrier
```

## Usage

```js
const MyCarrier = require('mycarrier');

const myCarrier = new MyCarrier({
    api_key: process.env.MYCARRIER_API_KEY
});

const response = await myCarrier.getShippingLocations({ take: 50 });
const shippingLocations = response.data.shippingLocations;
```

The client uses CommonJS, native `fetch`, promises, carrier-native request and response objects, and `@stores.com/http-error` errors. Node.js 18 or later is required.

## Authentication and configuration

Supply the API key issued for your MyCarrier account as `api_key`. Each request sends it in `X-Mc-Api-Key`.

See MyCarrier's [API-key authentication guide](https://help-center.mycarriertms.com/en/articles/11464701-order-api-authentication-update) for key setup and header requirements.

| Option | Default | Description |
| --- | --- | --- |
| `api_key` | Required from the caller | MyCarrier API key |
| `url` | `https://api.mycarriertms.com` | API base URL; the client appends endpoint paths starting with `/api/v1` |
| `timeout` | `60000` | Request timeout in milliseconds |

Every method accepts a final options object with a `timeout` override.

## Methods

### `getShippingLocation(locationId, options = {})`

Calls `GET /api/v1/address/shipping-locations/{locationId}`. Pass a `locationId` returned by `getShippingLocations()`. The ID is URL encoded, and the entire JSON response is returned, with the location's address, contacts, and carrier configuration in `data`. A missing location raises an `HttpError` with `error.cause.status === 404`.

See MyCarrier's [Get Shipping Location by Location ID reference](https://developer.mycarrier.io/reference/getshippinglocationbylocationid-1) for the identifier, response schema, and status codes.

```js
const response = await myCarrier.getShippingLocation('WAREHOUSE-1', { timeout: 15000 });
const shippingLocation = response.data;
```

### `getShippingLocations(query = {}, options = {})`

Calls `GET /api/v1/address/shipping-locations`. Query parameters are URL encoded and forwarded to the API. The entire JSON response is returned, including `data.shippingLocations`. Each request returns one page; use `skip` and `take` to retrieve additional pages.

See MyCarrier's [Get Shipping Locations List reference](https://developer.mycarrier.io/reference/getshippinglocations-1) for the `skip` and `take` parameters, response schema, and status codes.

```js
const response = await myCarrier.getShippingLocations({ take: 50 }, { timeout: 15000 });
```

### `getRates(request, options = {})`

Calls `POST /api/v1/quote/rate`. Pass a rate request in MyCarrier's schema; the library serializes it as JSON. The entire JSON response is returned, including `data.rates` and `data.statusInfo`.

See MyCarrier's [Get Rates reference](https://developer.mycarrier.io/reference/getrates-1) for the request fields, allowed values, response schema, and status codes.

```js
// rateRequest is a MyCarrier request containing your stops and shipping details.
const response = await myCarrier.getRates({
    ...rateRequest,
    action: 'RATE_ONLY'
}, { timeout: 90000 });

const rates = response.data.rates;
```

Use `RATE_ONLY` for estimates. The API also supports actions that save quotes; this client forwards the action supplied by the caller. Applications should inspect each rate's `statusInfo`: a rate may contain a price and still report an error. Account configuration, contacts, and supported payment terms can affect which carriers return rates.

### `getShipmentDetails(id, options = {})`

Calls `GET /api/v1/shipments/{id}`. Pass a shipment ID or quote reference ID. The ID is URL encoded, and the entire JSON response is returned, with shipment details in `data`, including its status, stops, pricing, and document links. A missing shipment raises an `HttpError` with `error.cause.status === 404`.

See MyCarrier's [Get Shipment Details documentation](https://developer.mycarrier.io/reference/shipmentdetails-2) for the identifier, response schema, and status codes.

```js
const response = await myCarrier.getShipmentDetails('SHIPMENT-1', { timeout: 15000 });
const shipment = response.data;
const status = shipment.statusCode;
```

This initial release covers these four endpoints.

## Errors

Every non-2xx response throws an [`HttpError`](https://github.com/stores-com/http-error), including HTTP 400. It retains:

- `error.cause.status`: HTTP status code.
- `error.json`: parsed response body, when the body is valid JSON.
- `error.text`: original response body, when available.

MyCarrier can return HTTP 400 with carrier decline reasons or validation details. Applications can inspect those details on the HTTP error:

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

Network failures, timeouts, and invalid JSON in successful responses propagate as native errors. Check each returned rate's `statusInfo` for carrier errors, including responses with HTTP 200.

## Development

```sh
npm install
npx eslint .
npm test
npm run test:coverage
npm pack --dry-run
```

Use Node.js 24 for development tooling. Tests use mocked HTTP requests and synthetic responses. CI runs lint on Node.js 24 and tests across Node.js 18, 20, 22, and 24.

The manual Publish workflow verifies `main`, publishes with provenance, and creates a GitHub release.

## License

MIT © Stores.com
