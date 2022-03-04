import nextConnect from 'next-connect';
import controller from 'models/controller.js';
import user from 'models/user.js';
import authentication from 'models/authentication.js';
import authorization from 'models/authorization.js';
import { ForbiddenError } from 'errors/index.js';

export default nextConnect({
  attachParams: true,
  onNoMatch: controller.onNoMatchHandler,
  onError: controller.onErrorHandler,
})
  .use(controller.injectRequestId)
  .use(authentication.injectAnonymousOrUser)
  .get(authorization.canRequest('read:user'), getHandler)
  .patch(authorization.canRequest('update:user'), patchHandler);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  // TODO: Insecure value from the request must be filtered before being used.
  const userStoredFromDatabase = await user.findOneByUsername(request.query.username);

  const secureOutputValues = authorization.filterOutput(userTryingToGet, 'read:user', userStoredFromDatabase);

  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToPatch = request.context.user;
  const targetUsername = request.query.username;
  const targetUser = await user.findOneByUsername(targetUsername);
  const insecureInputValues = request.body;
  const secureInputValues = authorization.filterInput(userTryingToPatch, 'update:user', insecureInputValues);

  if (!authorization.can(userTryingToPatch, 'update:user', targetUser)) {
    throw new ForbiddenError({
      message: 'Você não possui permissão para atualizar outro usuário.',
      action: 'Verifique se você possui a feature "update:user:others_email".',
      errorUniqueCode: 'CONTROLLER:USERS:USERNAME:PATCH:USER_CANT_UPDATE_OTHER_USER',
    });
  }

  const updatedUser = await user.update(targetUsername, secureInputValues);

  const secureOutputValues = authorization.filterOutput(userTryingToPatch, 'read:user', updatedUser);

  return response.status(200).json(secureOutputValues);
}
