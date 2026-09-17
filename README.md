# MyCarrier

A Node.js client for MyCarrier LTL freight rates, saved shipping locations, and shipment details.

Official documentation: [MyCarrier Developer Guide](https://developer.mycarrier.io/docs/getting-started) · [MyCarrier API Reference](https://developer.mycarrier.io/reference).

```sh
npm install github:stores-com/my-carrier
```

The initial release is available from GitHub; npm registry publication is pending. Once published, install with `npm install my-carrier`.

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

MyCarrier's newer [Order API authentication update](https://help-center.mycarriertms.com/en/articles/11464701-order-api-authentication-update) documents the switch from Basic authentication to `X-MC-Api-Key`. The older [developer authentication guide](https://developer.mycarrier.io/docs/authentication-1) still describes Basic authentication; the endpoint references and this client use the API-key header.

| Option | Default | Description |
| --- | --- | --- |
| `api_key` | Required from the caller | MyCarrier API key |
| `url` | `https://api.mycarriertms.com` | API base URL, without `/api/v1` |
| `timeout` | `60000` | Request timeout in milliseconds |

Every method accepts a final options object with a `timeout` override. Requests are made once; retry and caching policies belong to the application.

## Methods

### `getShippingLocation(locationId, options = {})`

Calls `GET /api/v1/address/shipping-locations/{locationId}`. Pass a `locationId` returned by `getShippingLocations()`. The ID is URL encoded, and the entire JSON response is returned, with the location's address, contacts, and carrier configuration in `data`. A missing location raises an `HttpError` with `error.cause.status === 404`.

See MyCarrier's [Get Shipping Location by Location ID reference](https://developer.mycarrier.io/reference/getshippinglocationbylocationid-1) for the identifier, response schema, and status codes.

```js
const response = await myCarrier.getShippingLocation('WAREHOUSE-1', { timeout: 15000 });
const shippingLocation = response.data;
```

### `getShippingLocations(query = {}, options = {})`

Calls `GET /api/v1/address/shipping-locations`. Query parameters are URL encoded and forwarded to the API. The entire JSON response is returned, including `data.shippingLocations`. Pagination is explicit: this method makes one request and does not automatically fetch subsequent pages.

See MyCarrier's [Get Shipping Locations List reference](https://developer.mycarrier.io/reference/getshippinglocations-1) for the `skip` and `take` parameters, response schema, and status codes.

```js
const response = await myCarrier.getShippingLocations({ take: 50 }, { timeout: 15000 });
```

### `getRates(request, options = {})`

Calls `POST /api/v1/quote/rate`. Pass a rate request in MyCarrier's own schema; the library serializes it without adding account, address, payment, freight-class, or shipment defaults. The entire JSON response is returned, including `data.rates` and `data.statusInfo`.

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

## Webhooks

MyCarrier's [Webhooks Guide](https://developer.mycarrier.io/docs/webhooks) describes notifications sent **from MyCarrier to your application's HTTP endpoint**. It documents these events:

- [shipment.created](https://developer.mycarrier.io/docs/update-shipment-webhook) — shipment dispatched.
- [shipment.updated](https://developer.mycarrier.io/docs/update-shipment-webhooks) — shipment updated.
- [shipment.canceled](https://developer.mycarrier.io/docs/canceled-shipment-webhook) — shipment canceled.
- [shipment.tracking.updated](https://developer.mycarrier.io/docs/shipment-tracking-webhook) — tracking updated.
- [invoice.auto_approve](https://developer.mycarrier.io/docs/invoice-auto-approved) — invoice automatically approved.
- [invoice.approve](https://developer.mycarrier.io/docs/invoice-approved-webhook) — invoice manually approved.

Payloads vary by event. The created, updated, and canceled shipment examples use `{ Message, Payload }`; the tracking example places shipment fields at the top level. Use each event's documented sample rather than assuming a shared envelope.

After your application has authenticated and validated a shipment-event delivery, including its identifier, you can retrieve current shipment details:

```js
const payload = body.Payload ?? body;
const response = await myCarrier.getShipmentDetails(payload.ShipmentId ?? payload.QuoteReferenceId);
```

The API-reference routes [POST /carrierintegrations/webhook/smc3/documents](https://developer.mycarrier.io/reference/postcarrierintegrationswebhooksmc3documents) and [POST /carrierintegrations/webhook/smc3/status](https://developer.mycarrier.io/reference/postcarrierintegrationswebhooksmc3status) accept document and status payloads **into MyCarrier**; they do not register customer callback URLs. Their paths and schemas suggest SMC3 is the intended caller, but that is an inference rather than an explicit statement in the documentation.

The public guide mentions registering a webhook but gives no registration procedure, API, or UI location. Customer callback setup and delivery authentication remain unverified, so this client does not provide a webhook registration method.

For account setup, ask MyCarrier where to register your HTTPS callback URL and desired event names, how deliveries are authenticated, and what acknowledgement and retry behavior your receiver must support. For shipment tracking, request `shipment.tracking.updated`; add the other shipment events as needed.

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
npx eslint .
npm test
npm run test:coverage
npm pack --dry-run
```

Use Node.js 24 for development tooling. The tests use synthetic responses and require no account credentials or live carrier requests. CI runs lint on Node.js 24 and tests across Node.js 18, 20, 22, and 24. The npm package contains only the client, package metadata, README, license, and changelog.

The manual Publish workflow runs lint and tests on the checked-out `main` commit before publishing with provenance and creating a GitHub release. Configure npm publishing authorization for the repository before running it.

## License

MIT © Stores.com
