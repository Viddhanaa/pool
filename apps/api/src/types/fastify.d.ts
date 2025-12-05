import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      userId: string;
      walletAddress: string;
      iat: number;
      exp: number;
    };
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      walletAddress: string;
      iat: number;
      exp: number;
    };
  }
}
