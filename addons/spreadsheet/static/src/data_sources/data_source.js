/** @odoo-module */

import { LoadingDataError } from "@spreadsheet/o_spreadsheet/errors";
import { RPCError } from "@web/core/network/rpc";
import { KeepLast } from "@web/core/utils/concurrency";
import { CellErrorType, EvaluationError } from "@odoo/o-spreadsheet";

/**
 * DataSource is an abstract class that contains the logic of fetching and
 * maintaining access to data that have to be loaded.
 *
 * A class which extends this class have to implement the `_load` method
 * * which should load the data it needs
 *
 * Subclass can implement concrete methods to have access to a
 * particular data.
 */
export class LoadableDataSource {
    constructor(params) {
        this._orm = params.orm;
        this._metadataRepository = params.metadataRepository;
        this._notifyWhenPromiseResolves = params.notifyWhenPromiseResolves;
        this._cancelPromise = params.cancelPromise;

        /**
         * Last time that this dataSource has been updated
         */
        this._lastUpdate = undefined;

        this._concurrency = new KeepLast();
        /**
         * Promise to control the loading of data
         */
        this._loadPromise = undefined;
        this._isFullyLoaded = false;
        this._isValid = true;
        /** @type {string} */
        this._loadErrorMessage = "";
    }

    /**
     * Load data in the model
     * @param {object} [params] Params for fetching data
     * @param {boolean} [params.reload=false] Force the reload of the data
     *
     * @returns {Promise} Resolved when data are fetched.
     */
    async load(params) {
        if (params && params.reload) {
            this._cancelPromise(this._loadPromise);
            this._loadPromise = undefined;
        }
        if (!this._loadPromise) {
            this._isFullyLoaded = false;
            this._isValid = true;
            this._loadErrorMessage = "";
            this._loadPromise = this._concurrency
                .add(this._load())
                .catch((e) => {
                    this._isValid = false;
                    this._loadErrorMessage = e instanceof RPCError ? e.data.message : e.message;
                })
                .finally(() => {
                    this._lastUpdate = Date.now();
                    this._isFullyLoaded = true;
                });
            await this._notifyWhenPromiseResolves(this._loadPromise);
        }
        return this._loadPromise;
    }

    get lastUpdate() {
        return this._lastUpdate;
    }

    /**
     * @returns {boolean}
     */
    isReady() {
        return this._isFullyLoaded;
    }

    assertIsValid({ throwOnError } = { throwOnError: true }) {
        if (!this._isFullyLoaded) {
            this.load();
            if (throwOnError) {
                throw LOADING_ERROR;
            }
            return LOADING_ERROR;
        }
        if (!this._isValid) {
            if (throwOnError) {
                throw new EvaluationError(this._loadErrorMessage);
            }
            return { value: CellErrorType.GenericError, message: this._loadErrorMessage };
        }
    }

    /**
     * Load the data in the model
     *
     * @abstract
     * @protected
     */
    async _load() {}
}

const LOADING_ERROR = new LoadingDataError();
