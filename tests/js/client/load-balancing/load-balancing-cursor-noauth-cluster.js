/* jshint globalstrict:true, strict:true, maxlen: 5000 */
/* global assertTrue, assertFalse, assertEqual, require*/

////////////////////////////////////////////////////////////////////////////////
/// DISCLAIMER
///
/// Copyright 2018 ArangoDB GmbH, Cologne, Germany
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///
/// Copyright holder is ArangoDB GmbH, Cologne, Germany
///
/// @author Dan Larkin-York
/// @author Copyright 2018, ArangoDB GmbH, Cologne, Germany
////////////////////////////////////////////////////////////////////////////////

'use strict';

const jsunity = require("jsunity");

const db = require("internal").db;
const request = require("@arangodb/request");
const url = require('url');
const _ = require("lodash");

function getCoordinators() {
  const isCoordinator = (d) => (_.toLower(d.role) === 'coordinator');
  const toEndpoint = (d) => (d.endpoint);
  const endpointToURL = (endpoint) => {
    if (endpoint.substr(0, 6) === 'ssl://') {
      return 'https://' + endpoint.substr(6);
    }
    var pos = endpoint.indexOf('://');
    if (pos === -1) {
      return 'http://' + endpoint;
    }
    return 'http' + endpoint.substr(pos);
  };

  const instanceInfo = JSON.parse(require('internal').env.INSTANCEINFO);
  return instanceInfo.arangods.filter(isCoordinator)
                              .map(toEndpoint)
                              .map(endpointToURL);
}

const servers = getCoordinators();

function CursorSyncSuite () {
  'use strict';
  const cns = ["animals", "fruits"];
  const keys = [
    ["ant", "bird", "cat", "dog"],
    ["apple", "banana", "coconut", "date"]
  ];
  let cs = [];
  let coordinators = [];
  const baseCursorUrl = `/_api/cursor`;

  function sendRequest(method, endpoint, body, usePrimary) {
    let res;
    const i = usePrimary ? 0 : 1;

    try {
      const envelope = {
        body,
        json: true,
        method,
        url: `${coordinators[i]}${endpoint}`
      };
      res = request(envelope);
    } catch(err) {
      console.error(`Exception processing ${method} ${endpoint}`, err.stack);
      return {};
    }

    var resultBody = res.body;
    if (typeof resultBody === "string") {
      resultBody = JSON.parse(resultBody);
    }
    return resultBody;
  }

  return {
    setUp: function() {
      coordinators = getCoordinators();
      if (coordinators.length < 2) {
        throw new Error('Expecting at least two coordinators');
      }

      cs = [];
      for (let i = 0; i < cns.length; i++) {
        db._drop(cns[i]);
        cs.push(db._create(cns[i]));
        assertTrue(cs[i].name() === cns[i]);
        for (let key in keys[i]) {
          cs[i].save({ _key: key });
        }
      }

      require("internal").wait(2);
    },

    tearDown: function() {
      db._drop(cns[0]);
      db._drop(cns[1]);
      cs = [];
      coordinators = [];
    },

    testCursorForwardingBasic: function() {
      let url = baseCursorUrl;
      const query = {
        query: `FOR doc IN @@coll LIMIT 4 RETURN doc`,
        count: true,
        batchSize: 2,
        bindVars: {
          "@coll": cns[0]
        }
      };
      let result = sendRequest('POST', url, query, true);

      assertFalse(result === undefined || result === {});
      assertFalse(result.error);
      assertEqual(result.code, 201);
      assertTrue(result.hasMore);
      assertEqual(result.count, 4);
      assertEqual(result.result.length, 2);

      const cursorId = result.id;
      url = `${baseCursorUrl}/${cursorId}`;
      result = sendRequest('PUT', url, {}, false);

      assertFalse(result === undefined || result === {});
      assertFalse(result.error);
      assertEqual(result.code, 200);
      assertFalse(result.hasMore);
      assertEqual(result.count, 4);
      assertEqual(result.result.length, 2);

      url = `${baseCursorUrl}/${cursorId}`;
      result = sendRequest('PUT', url, {}, false);

      assertFalse(result === undefined || result === {});
      assertTrue(result.error);
      assertEqual(result.code, 404);
    },

    testCursorForwardingDeletion: function() {
      let url = baseCursorUrl;
      const query = {
        query: `FOR doc IN @@coll LIMIT 4 RETURN doc`,
        count: true,
        batchSize: 2,
        bindVars: {
          "@coll": cns[0]
        }
      };
      let result = sendRequest('POST', url, query, true);

      assertFalse(result === undefined || result === {});
      assertFalse(result.error);
      assertEqual(result.code, 201);
      assertTrue(result.hasMore);
      assertEqual(result.count, 4);
      assertEqual(result.result.length, 2);

      const cursorId = result.id;
      url = `${baseCursorUrl}/${cursorId}`;
      result = sendRequest('DELETE', url, {}, false);

      assertFalse(result === undefined || result === {});
      assertFalse(result.error);
      assertEqual(result.code, 202);

      url = `${baseCursorUrl}/${cursorId}`;
      result = sendRequest('PUT', url, {}, false);

      assertFalse(result === undefined || result === {});
      assertTrue(result.error);
      assertEqual(result.code, 404);
    },

  };
}

jsunity.run(CursorSyncSuite);

return jsunity.done();
