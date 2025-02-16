/**
 * TypeScript version of Axios mock for unit testing with [Jest](https://facebook.github.io/jest/).
 * This file is based on https://gist.github.com/tux4/36006a1859323f779ab0
 *
 * @author   knee-cola <nikola.derezic@gmail.com>
 * @license  @license MIT License, http://www.opensource.org/licenses/MIT
 */

import { SynchronousPromise, UnresolvedSynchronousPromise  } from "synchronous-promise";
import Cancel from "./cancel/Cancel";
import CancelToken from "./cancel/CancelToken";
import {
    AxiosMockQueueItem,
    AxiosMockType,
    HttpResponse,
} from "./mock-axios-types";

/** a FIFO queue of pending request */
const _pending_requests: AxiosMockQueueItem[] = [];

const _newReq: (config?: any) => UnresolvedSynchronousPromise<any> = (config: any = {}) => {
    const url: string = config.url;
    const data: any = config.data;
    const promise: UnresolvedSynchronousPromise<any> = SynchronousPromise.unresolved();
    _pending_requests.push({
        config,
        data,
        promise,
        url,
    });
    return promise;
};

const _helperReq = (url: string, data?: any, config?: any) => {
    const conf = data && config ? config : {};
    return _newReq({
        ...conf,
        data,
        url,
    });
};

const MockAxios: AxiosMockType = (jest.fn(_newReq) as unknown) as AxiosMockType;

// mocking Axios methods
MockAxios.get = jest.fn(_helperReq);
MockAxios.post = jest.fn(_helperReq);
MockAxios.put = jest.fn(_helperReq);
MockAxios.patch = jest.fn(_helperReq);
MockAxios.delete = jest.fn(_helperReq);
MockAxios.request = jest.fn(_newReq);
MockAxios.all = jest.fn((values) => Promise.all(values));
MockAxios.head = jest.fn(_helperReq);
MockAxios.options = jest.fn(_helperReq);
MockAxios.create = jest.fn(() => MockAxios);

MockAxios.interceptors = {
    request: {
        use: jest.fn(),
    },
    response: {
        use: jest.fn(),
    },
};

MockAxios.defaults = {
    headers: {
        common: [],
    },
};

MockAxios.popPromise = (promise?: SynchronousPromise<any>) => {
    if (promise) {
        // remove the promise from pending queue
        for (let ix = 0; ix < _pending_requests.length; ix++) {
            const req: AxiosMockQueueItem = _pending_requests[ix];

            if (req.promise === promise) {
                _pending_requests.splice(ix, 1);
                return req.promise;
            }
        }
    } else {
        // take the oldest promise
        const req: AxiosMockQueueItem = _pending_requests.shift();
        return req ? req.promise : void 0;
    }
};

MockAxios.popRequest = (request?: AxiosMockQueueItem) => {
    if (request) {
        const ix = _pending_requests.indexOf(request);
        if (ix === -1) {
            return void 0;
        }

        _pending_requests.splice(ix, 1);
        return request;
    } else {
        return _pending_requests.shift();
    }
};

/**
 * Removes an item form the queue, based on it's type
 * @param queueItem
 */
const popQueueItem = (queueItem: SynchronousPromise<any> | AxiosMockQueueItem = null) => {
    // first let's pretend the param is a queue item
    const request: AxiosMockQueueItem = MockAxios.popRequest(
        queueItem as AxiosMockQueueItem,
    );

    if (request) {
        // IF the request was found
        // > set the promise
        return request.promise;
    } else {
        // ELSE maybe the `queueItem` is a promise (legacy mode)
        return MockAxios.popPromise(queueItem as UnresolvedSynchronousPromise<any>);
    }
};

MockAxios.mockResponse = (
    response?: HttpResponse,
    queueItem: SynchronousPromise<any> | AxiosMockQueueItem = null,
    silentMode: boolean = false,
): void => {
    // replacing missing data with default values
    response = Object.assign(
        {
            config: {},
            data: {},
            headers: {},
            status: 200,
            statusText: "OK",
        },
        response,
    );

    const promise = popQueueItem(queueItem);

    if (!promise && !silentMode) {
        throw new Error("No request to respond to!");
    } else if (!promise) {
        return;
    }

    // resolving the Promise with the given response data
    promise.resolve(response);
};

MockAxios.mockError = (
    error: any = {},
    queueItem: SynchronousPromise<any> | AxiosMockQueueItem = null,
    silentMode: boolean = false,
) => {
    const promise = popQueueItem(queueItem);

    if (!promise && !silentMode) {
        throw new Error("No request to respond to!");
    } else if (!promise) {
        return;
    }

    // resolving the Promise with the given response data
    promise.reject(error);
};

MockAxios.lastReqGet = () => {
    return _pending_requests[_pending_requests.length - 1];
};

MockAxios.lastPromiseGet = () => {
    const req = MockAxios.lastReqGet();
    return req ? req.promise : void 0;
};

MockAxios.getReqByUrl = (url: string) => {
    return _pending_requests
        .slice()
        .reverse() // reverse cloned array to return most recent req
        .find((x: AxiosMockQueueItem) => x.url === url);
};

MockAxios.reset = () => {
    // remove all the requests
    _pending_requests.splice(0, _pending_requests.length);

    // resets all information stored in the mockFn.mock.calls and mockFn.mock.instances arrays
    MockAxios.get.mockClear();
    MockAxios.post.mockClear();
    MockAxios.put.mockClear();
    MockAxios.patch.mockClear();
    MockAxios.delete.mockClear();
    MockAxios.head.mockClear();
    MockAxios.options.mockClear();
    MockAxios.request.mockClear();
    MockAxios.all.mockClear();
};

MockAxios.Cancel = Cancel;
MockAxios.CancelToken = CancelToken;
MockAxios.isCancel = (u): u is Cancel => {
    return !!(u && u.__CANCEL__);
};

// this is a singleton object
export default MockAxios;
