/**
 *    Copyright (C) 2015 MongoDB Inc.
 *
 *    This program is free software: you can redistribute it and/or  modify
 *    it under the terms of the GNU Affero General Public License, version 3,
 *    as published by the Free Software Foundation.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU Affero General Public License for more details.
 *
 *    You should have received a copy of the GNU Affero General Public License
 *    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 *    As a special exception, the copyright holders give permission to link the
 *    code of portions of this program with the OpenSSL library under certain
 *    conditions as described in each individual source file and distribute
 *    linked combinations including the program with the OpenSSL library. You
 *    must comply with the GNU Affero General Public License in all respects for
 *    all of the code used other than as permitted herein. If you modify file(s)
 *    with this exception, you may extend this exception to your version of the
 *    file(s), but you are not obligated to do so. If you do not wish to do so,
 *    delete this exception statement from your version. If you delete this
 *    exception statement from all source files in the program, then also delete
 *    it in the license file.
 */

#include "mongo/platform/basic.h"

#include "mongo/db/auth/authorization_session.h"
#include "mongo/db/commands.h"
#include "mongo/db/query/cursor_response.h"
#include "mongo/db/query/getmore_request.h"
#include "mongo/db/stats/counters.h"
#include "mongo/s/query/cluster_cursor_manager.h"
#include "mongo/s/query/cluster_find.h"

namespace mongo {
namespace {

/**
 * Implements the getMore command on mongos. Retrieves more from an existing mongos cursor
 * corresponding to the cursor id passed from the application. In order to generate these results,
 * may issue getMore commands to remote nodes in one or more shards.
 */
class ClusterGetMoreCmd final : public TypedCommand<ClusterGetMoreCmd> {
public: 
    struct Request {
        static constexpr auto kCommandName = "getMore"_sd;
        static Request parse(const IDLParserErrorContext&, const OpMsgRequest& request){
            return Request{request};
        }

        const OpMsgRequest& request;
    };

    class Invocation final : public MinimalInvocationBase {
    public:
        using MinimalInvocationBase::MinimalInvocationBase;

    private:
        NamespaceString ns() {
            auto dbName = request().request.getDatabase().toString();
            return GetMoreRequest::parseNs(dbName, request().body);
        }

        virtual bool supportsWriteConcern(const BSONObj& cmd) const override {
            return false;
        }

        Status checkAuthForCommand(Client* client,
                        const std::string& dbname,
                        const BSONObj& cmdObj) const final {
            StatusWith<GetMoreRequest> parseStatus = GetMoreRequest::parseFromBSON(dbname, cmdObj);
            if (!parseStatus.isOK()) {
                return parseStatus.getStatus();
            }
            const GetMoreRequest& request = parseStatus.getValue();

            return AuthorizationSession::get(client)->checkAuthForGetMore(
                request.nss, request.cursorid, request.term.is_initialized());
        }

        void doCheckAuthorization(OperationContext* opCtx) const override {
            auto dbName = request().request.getDatabase().toString();
            uassertStatusOK(checkAuthForCommand(opCtx, dbName, request().request.body));
        }

        void run(OperationContext* opCtx, rpc::ReplyBuilderInterface* reply) final {
            // Counted as a getMore, not as a command.
            globalOpCounters.gotGetMore();

            StatusWith<GetMoreRequest> parseStatus = GetMoreRequest::parseFromBSON(dbname, cmdObj);
            uassertStatusOK(parseStatus.getStatus());
            const GetMoreRequest& request = parseStatus.getValue();
            
            auto bob = reply->getBodyBuilder();
            try {
                auto response = ClusterFind::runGetMore(opCtx, request);
                uassertStatusOK(response.getStatus());

                response.getValue().addToBSON(CursorResponse::ResponseType::SubsequentResponse, &reply->getBodyBuilder());
                CommandHelpers::appendSimpleCommandStatus(bob, true);
            } catch (const ExceptionFor<ErrorCodes::Unauthorized>& e) {
                CommandHelpers::auditLogAuthEvent(opCtx, this, *_request, e.code());
                throw;
            }
        }

    }
    
    AllowedOnSecondary secondaryAllowed(ServiceContext*) const final {
        return AllowedOnSecondary::kAlways;
    }

    bool maintenanceOk() const final {
        return false;
    }

    bool adminOnly() const final {
        return false;
    }

    /**
     * A getMore command increments the getMore counter, not the command counter.
     */
    bool shouldAffectCommandCounter() const final {
        return false;
    }

    std::string help() const final {
        return "retrieve more documents for a cursor id";
    }

    LogicalOp getLogicalOp() const final {
        return LogicalOp::opGetMore;
    }
};
constexpr StringData ClusterGetMoreCmd::Request::kCommandName;

}  // namespace
}  // namespace mongo
