/*
 * Copyright 2021 Lightbend Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const protobufHelper = require('./protobuf-helper');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const ViewServices = require('./view-support');
const Kalix = require('./kalix');

const viewServices = new ViewServices();

/**
 * Options for a view.
 *
 * @typedef module:kalix.View~options
 * @property {string} [viewId=serviceName] The id for the view, used for persisting the view.
 * @property {array<string>} [includeDirs=["."]] The directories to include when looking up imported protobuf files.
 */

/**
 * View handlers
 * The names of the properties must match the names of all the view methods specified in the gRPC
 * descriptor.
 *
 * @typedef module:kalix.View~handlers
 * @type {Object<string, module:kalix.View~handler>}
 */

/**
 * A handler for transforming an incoming event and the previous view state into a new state
 *
 * @callback module:kalix.View~handler
 * @param {Object} event The event, this will be of the type of the gRPC event handler input type.
 * @param {undefined|module:kalix.Serializable} state The previous view state or 'undefined' if no previous state was stored.
 * @param {module:kalix.View.UpdateHandlerContext} context The view handler context.
 * @returns {undefined|module:kalix.Serializable} The state to store in the view or undefined to not update/store state for the event
 */

/**
 * A view.
 *
 * @memberOf module:kalix
 * @implements module:kalix.Component
 */
class View {
  /**
   * Create a new view.
   *
   * @constructs
   * @param {string|string[]} desc A descriptor or list of descriptors to parse, containing the service to serve.
   * @param {string} serviceName The fully qualified name of the service that provides this interface.
   * @param {module:kalix.View~options=} options The options for this view
   */
  constructor(desc, serviceName, options) {
    /**
     * @type {module:kalix.View~options}
     */
    this.options = {
      ...{
        includeDirs: ['.'],
        // default view id, name without package from service name
        viewId: serviceName.split('.').pop(),
      },
      ...options,
    };

    this.options.entityType = this.options.viewId;

    const allIncludeDirs = protobufHelper.moduleIncludeDirs.concat(
      this.options.includeDirs,
    );

    this.root = protobufHelper.loadSync(desc, allIncludeDirs);

    /**
     * @type {string}
     */
    this.serviceName = serviceName;

    // Eagerly lookup the service to fail early
    /**
     * @type {protobuf.Service}
     */
    this.service = this.root.lookupService(serviceName);

    const packageDefinition = protoLoader.loadSync(desc, {
      includeDirs: allIncludeDirs,
    });
    this.grpc = grpc.loadPackageDefinition(packageDefinition);
  }

  /**
   * @return {string} view component type.
   */
  componentType() {
    return viewServices.componentType();
  }

  /**
   * Lookup a protobuf message type.
   *
   * This is provided as a convenience to lookup protobuf message types.
   *
   * @param {string} messageType The fully qualified name of the type to lookup.
   * @return {protobuf.Type} The protobuf message type.
   */
  lookupType(messageType) {
    return this.root.lookupType(messageType);
  }

  /**
   * Set the update handlers of the view. Only used for updates where event transformation is enabled through
   * "transform_updates: true" in the grpc descriptor.
   *
   * @param {module:kalix.View~handlers} handlers The handler callbacks.
   * @return {module:kalix.View} This view.
   */
  setUpdateHandlers(handlers) {
    this.updateHandlers = handlers;
    return this;
  }

  register(allComponents) {
    viewServices.addService(this, allComponents);
    return viewServices;
  }
}

module.exports = View;
