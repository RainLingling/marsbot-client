/**
 * Marsbot Client - tRPC Stub
 * 本地客户端不使用 tRPC，此文件提供兼容性存根
 * 面板组件中少量 tRPC 调用通过此存根重定向到本地 IPC
 */

// 创建一个通用的 mutation/query 存根
function createMutationStub() {
  return {
    useMutation: (options?: { onSuccess?: (data: unknown) => void; onError?: (err: unknown) => void }) => ({
      mutate: (_input?: unknown) => {
        console.warn("[tRPC Stub] useMutation called - not supported in offline mode");
        options?.onError?.(new Error("离线模式不支持此操作"));
      },
      mutateAsync: async (_input?: unknown) => {
        console.warn("[tRPC Stub] mutateAsync called - not supported in offline mode");
        throw new Error("离线模式不支持此操作");
      },
      isLoading: false,
      isPending: false,
      isError: false,
      data: undefined,
      error: null,
    }),
    useQuery: (_input?: unknown, _options?: unknown) => ({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: async () => {},
    }),
  };
}

// 递归代理，支持任意深度的属性访问
function createDeepProxy(): unknown {
  return new Proxy({} as Record<string, unknown>, {
    get(_target, prop) {
      if (prop === "useMutation") {
        return (options?: unknown) => createMutationStub().useMutation(options as Parameters<ReturnType<typeof createMutationStub>["useMutation"]>[0]);
      }
      if (prop === "useQuery") {
        return createMutationStub().useQuery;
      }
      return createDeepProxy();
    },
  });
}

export const trpc = createDeepProxy() as {
  loan: {
    generateCreditRiskReport: { useMutation: ReturnType<typeof createMutationStub>["useMutation"] };
    getApplicationGraph: { useQuery: ReturnType<typeof createMutationStub>["useQuery"] };
    analyzeDimensions: { useMutation: ReturnType<typeof createMutationStub>["useMutation"] };
  };
  chat: {
    searchCompanyWeb: { useMutation: ReturnType<typeof createMutationStub>["useMutation"] };
  };
  industry: {
    analyzeFromProfile: { useMutation: ReturnType<typeof createMutationStub>["useMutation"] };
  };
  [key: string]: unknown;
};
