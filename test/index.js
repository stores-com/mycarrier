const assert = require('node:assert/strict');
const test = require('node:test');

const HttpError = require('@stores.com/http-error');

const MyCarrier = require('../index');

const endpoints = [
    {
        name: 'getShippingLocation',
        path: '/api/v1/address/shipping-locations/location-1',
        invoke: (client, options) => client.getShippingLocation('location-1', options)
    },
    {
        name: 'getShippingLocations',
        path: '/api/v1/address/shipping-locations',
        invoke: (client, options) => client.getShippingLocations({}, options)
    },
    {
        name: 'getRates',
        path: '/api/v1/quote/rate',
        invoke: (client, options) => client.getRates({ action: 'RATE_ONLY' }, options)
    }
];

test('shipping locations preserves the response and uses API-key authentication at the default endpoint', async (t) => {
    const body = {
        data: { shippingLocations: [{ id: 'location-1', description: 'Warehouse' }] },
        pagination: { total: 1 },
        traceId: 'locations-request'
    };
    const calls = [];

    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push({ url, options });
        return Response.json(body);
    });

    const client = new MyCarrier({ api_key: 'first-key' });
    const result = await client.getShippingLocations();

    assert.deepEqual(result, body);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.mycarriertms.com/api/v1/address/shipping-locations');
    assert.equal(calls[0].options.method ?? 'GET', 'GET');
    assert.equal(calls[0].options.body, undefined);
    assert.deepEqual([...new Headers(calls[0].options.headers)], [['x-mc-api-key', 'first-key']]);
});

test('a shipping location preserves its full response and treats the location ID as one path segment', async (t) => {
    const locationId = 'Dock A/B?zone#50% Caf\u00e9';
    const body = {
        data: {
            locationId,
            addressLine1: '123 Example Street',
            contacts: [{ name: 'Example Contact', email: 'contact@example.test' }],
            integratedCarriers: [{ name: 'Example Carrier', active: true }],
            customerExtension: { active: false, instructions: null }
        },
        errors: [],
        statusCode: 200,
        traceId: 'shipping-location-request'
    };
    const calls = [];

    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push({ url: new URL(url), options });
        return Response.json(body);
    });

    const client = new MyCarrier({ api_key: 'location-key' });

    assert.deepEqual(await client.getShippingLocation(locationId), body);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.origin, 'https://api.mycarriertms.com');
    assert.equal(calls[0].url.pathname, '/api/v1/address/shipping-locations/Dock%20A%2FB%3Fzone%2350%25%20Caf%C3%A9');
    assert.equal(calls[0].url.search, '');
    assert.equal(calls[0].url.hash, '');
    assert.equal(calls[0].options.method ?? 'GET', 'GET');
    assert.equal(calls[0].options.body, undefined);
    assert.deepEqual([...new Headers(calls[0].options.headers)], [['x-mc-api-key', 'location-key']]);
});

test('a shipping location uses the configured URL prefix and preserves HTTP 404 diagnostics', async (t) => {
    const diagnostics = {
        data: null,
        statusInfo: { status: 'Error', message: 'Shipping location was not found.' },
        traceId: 'missing-location-request'
    };
    const calls = [];

    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push({ url, options });
        return Response.json(diagnostics, { status: 404, statusText: 'Not Found' });
    });

    const client = new MyCarrier({ api_key: 'custom-location-key', url: 'https://sandbox.example.test/proxy///' });

    await assert.rejects(client.getShippingLocation('missing-location'), error => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.cause.status, 404);
        assert.equal(error.message, '404 Not Found');
        assert.deepEqual(error.json, diagnostics);
        assert.equal(error.text, JSON.stringify(diagnostics));
        return true;
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://sandbox.example.test/proxy/api/v1/address/shipping-locations/missing-location');
    assert.deepEqual([...new Headers(calls[0].options.headers)], [['x-mc-api-key', 'custom-location-key']]);
});

test('rating forwards the complete request and preserves priced rates with carrier diagnostics', async (t) => {
    const request = {
        action: 'RATE_ONLY',
        externalReference: 'customer-reference',
        shipment: {
            items: [{ description: 'Fragile & oversized', quantity: 2, weight: 187.5 }],
            accessorials: ['LIFTGATE_DELIVERY'],
            customerExtension: { enabled: false, optionalValue: null }
        }
    };
    const originalRequest = structuredClone(request);
    const body = {
        data: {
            rates: [{ total: 125.75, statusInfo: { status: 'Error', message: 'Review carrier conditions' } }],
            statusInfo: { status: 'Complete' }
        },
        traceId: 'rate-request'
    };
    const calls = [];

    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push({ url, options });
        return Response.json(body, { status: 201 });
    });

    const client = new MyCarrier({ api_key: 'rating-key' });

    assert.deepEqual(await client.getRates(request), body);
    assert.deepEqual(request, originalRequest);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.mycarriertms.com/api/v1/quote/rate');
    assert.equal(calls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].options.body), originalRequest);
    assert.deepEqual([...new Headers(calls[0].options.headers)], [
        ['content-type', 'application/json'],
        ['x-mc-api-key', 'rating-key']
    ]);
});

test('custom API URLs retain their prefix, tolerate trailing slashes, and encode shipping-location filters', async (t) => {
    const calls = [];
    const query = { take: 50, search: 'Dock & Bay + #1 / east?', cursor: 'a=b&c=d' };
    const originalQuery = { ...query };

    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push({ url: new URL(url), options });
        return Response.json({ data: {} });
    });

    const client = new MyCarrier({ api_key: 'custom-key', url: 'https://sandbox.example.test/proxy///' });

    await client.getShippingLocations(query);
    await client.getRates({ action: 'RATE_ONLY' });

    assert.deepEqual(query, originalQuery);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url.origin, 'https://sandbox.example.test');
    assert.equal(calls[0].url.pathname, '/proxy/api/v1/address/shipping-locations');
    assert.deepEqual([...calls[0].url.searchParams], [
        ['take', '50'],
        ['search', query.search],
        ['cursor', query.cursor]
    ]);
    assert.equal(calls[0].url.hash, '');
    assert.equal(calls[1].url.href, 'https://sandbox.example.test/proxy/api/v1/quote/rate');
});

test('concurrent clients keep their API keys and endpoints isolated without token exchanges', async (t) => {
    const calls = [];

    t.mock.method(globalThis, 'fetch', async (url, options) => {
        const headers = new Headers(options.headers);

        calls.push({ url: new URL(url), headers });
        return Response.json({ account: headers.get('X-Mc-Api-Key') });
    });

    const first = new MyCarrier({ api_key: 'account-one', url: 'https://one.example.test' });
    const second = new MyCarrier({ api_key: 'account-two', url: 'https://two.example.test' });
    const results = await Promise.all([
        first.getRates({ action: 'RATE_ONLY' }),
        second.getShippingLocations(),
        second.getRates({ action: 'RATE_ONLY' }),
        first.getShippingLocations()
    ]);

    assert.deepEqual(results.map(result => result.account), ['account-one', 'account-two', 'account-two', 'account-one']);
    assert.equal(calls.length, 4);

    for (const call of calls) {
        assert.equal(call.headers.get('X-Mc-Api-Key'), call.url.hostname === 'one.example.test' ? 'account-one' : 'account-two');
        assert.equal(call.headers.has('Authorization'), false);
        assert.equal(call.url.search, '');
        assert.ok(endpoints.some(endpoint => call.url.pathname === endpoint.path));
    }
});

for (const endpoint of endpoints) {
    test(`${endpoint.name} applies default, client, and per-call timeouts`, async (t) => {
        const timeout = t.mock.method(AbortSignal, 'timeout');
        const signals = [];

        t.mock.method(globalThis, 'fetch', async (url, options) => {
            signals.push(options.signal);
            return Response.json({ data: {} });
        });

        await endpoint.invoke(new MyCarrier({ api_key: 'key' }));
        const client = new MyCarrier({ api_key: 'key', timeout: 90000 });

        await endpoint.invoke(client);
        await endpoint.invoke(client, { timeout: 120000 });
        await endpoint.invoke(client, { timeout: 0 });

        assert.deepEqual(timeout.mock.calls.map(call => call.arguments), [[60000], [90000], [120000], [0]]);
        assert.equal(signals.length, 4);
        assert.ok(signals.every(signal => signal instanceof AbortSignal));
        assert.equal(new Set(signals).size, 4);
    });

    test(`${endpoint.name} propagates the actual timeout abort`, async (t) => {
        let signal;

        t.mock.method(globalThis, 'fetch', async (url, options) => {
            signal = options.signal;
            return await new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => reject(signal.reason), { once: true });
            });
        });

        const client = new MyCarrier({ api_key: 'key' });
        const keepAlive = setTimeout(() => {}, 1000);

        try {
            await assert.rejects(endpoint.invoke(client, { timeout: 5 }), error => {
                assert.equal(error, signal.reason);
                assert.equal(error.name, 'TimeoutError');
                assert.equal(signal.aborted, true);
                assert.equal(error instanceof HttpError, false);
                return true;
            });
        } finally {
            clearTimeout(keepAlive);
        }
    });

    test(`${endpoint.name} preserves HTTP 400 carrier diagnostics on the shared HttpError`, async (t) => {
        const diagnostics = {
            data: { rates: [{ rateId: 'partial-rate', statusInfo: { status: 'Error' } }] },
            statusInfo: { status: 'Error', messages: ['Origin postal code is required'] },
            traceId: 'failed-request'
        };
        const body = JSON.stringify(diagnostics);
        const response = new Response(body, { status: 400, statusText: 'Bad Request', headers: { 'Content-Type': 'application/json' } });

        t.mock.method(globalThis, 'fetch', async () => response);

        await assert.rejects(endpoint.invoke(new MyCarrier({ api_key: 'key' })), error => {
            assert.ok(error instanceof HttpError);
            assert.equal(error.cause, response);
            assert.equal(error.cause.status, 400);
            assert.equal(error.message, '400 Bad Request');
            assert.deepEqual(error.json, diagnostics);
            assert.equal(error.text, body);
            return true;
        });

        assert.equal(await response.text(), body);
    });

    test(`${endpoint.name} reports an empty unauthorized response as HttpError`, async (t) => {
        t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 401, statusText: 'Unauthorized' }));

        await assert.rejects(endpoint.invoke(new MyCarrier({ api_key: 'invalid-key' })), error => {
            assert.ok(error instanceof HttpError);
            assert.equal(error.cause.status, 401);
            assert.equal(error.message, '401 Unauthorized');
            assert.equal(error.text, '');
            assert.equal(error.json, undefined);
            return true;
        });
    });

    test(`${endpoint.name} preserves a non-JSON server error`, async (t) => {
        const body = '<html>Upstream carrier unavailable</html>';

        t.mock.method(globalThis, 'fetch', async () => new Response(body, { status: 500, statusText: 'Internal Server Error' }));

        await assert.rejects(endpoint.invoke(new MyCarrier({ api_key: 'key' })), error => {
            assert.ok(error instanceof HttpError);
            assert.equal(error.cause.status, 500);
            assert.equal(error.message, '500 Internal Server Error');
            assert.equal(error.text, body);
            assert.equal(error.json, undefined);
            return true;
        });
    });

    test(`${endpoint.name} propagates network failures without changing their cause`, async (t) => {
        const networkError = new TypeError('fetch failed', { cause: new Error('ECONNRESET') });

        t.mock.method(globalThis, 'fetch', async () => {
            throw networkError;
        });

        await assert.rejects(endpoint.invoke(new MyCarrier({ api_key: 'key' })), error => error === networkError);
    });

    test(`${endpoint.name} rejects malformed JSON from a successful response`, async (t) => {
        t.mock.method(globalThis, 'fetch', async () => new Response('{invalid json', { status: 200 }));

        await assert.rejects(endpoint.invoke(new MyCarrier({ api_key: 'key' })), SyntaxError);
    });
}
