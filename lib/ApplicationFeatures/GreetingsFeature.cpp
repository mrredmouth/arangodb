////////////////////////////////////////////////////////////////////////////////
/// DISCLAIMER
///
/// Copyright 2016 ArangoDB GmbH, Cologne, Germany
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
/// @author Jan Steemann
////////////////////////////////////////////////////////////////////////////////

#include "GreetingsFeature.h"
#include "Logger/Logger.h"
#include "Rest/Version.h"

namespace arangodb {

GreetingsFeature::GreetingsFeature(application_features::ApplicationServer& server)
    : ApplicationFeature(server, "Greetings") {
  setOptional(false);
  startsAfter("Logger");
}

void GreetingsFeature::prepare() {
  LOG_TOPIC("e52b0", INFO, arangodb::Logger::FIXME)
      << "" << rest::Version::getVerboseVersionString();

  // building in maintainer mode or enabling catch test code will incur runtime overhead,
  // so warn users about this
  bool warn = false;
#ifdef ARANGODB_ENABLE_MAINTAINER_MODE
  warn = true;
#else
#ifdef ARANGODB_USE_CATCH_TESTS
  warn = true;
#endif
#endif
  if (warn) {
    LOG_TOPIC("0458b", WARN, arangodb::Logger::FIXME)
      << "This is a maintainer version intended for debugging. DO NOT USE IN PRODUCTION!";
    LOG_TOPIC("bd666", WARN, arangodb::Logger::FIXME)
      << "==============================================================================";

  }
}

void GreetingsFeature::unprepare() {
  LOG_TOPIC("4bcb9", INFO, arangodb::Logger::FIXME) << "ArangoDB has been shut down";
}

}  // namespace arangodb
