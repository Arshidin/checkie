import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface StoreContext {
  storeId: string;
  userId: string;
  role: string;
}

export const GetStoreContext = createParamDecorator(
  (data: keyof StoreContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const storeContext = request.storeContext as StoreContext;

    if (!storeContext) {
      return null;
    }

    return data ? storeContext[data] : storeContext;
  },
);
