import { storeToRefs } from "pinia";
import { useUserStore } from "~/stores/user";

type UseFetchOptions<T> = Omit<Parameters<typeof useFetch<T>>[1], "headers"> & {
  headers?: Record<string, any>;
};

type FetchOptions<T> = Omit<Parameters<typeof $fetch<T>>[1], "headers"> & {
  headers?: Record<string, any>;
};
/**
 * useFetchWithAuth - wrapper that preserves typeof useFetch while injecting the Bearer token.
 */
export const useFetchWithAuth: typeof useFetch = <T>(
  url: string,
  options: UseFetchOptions<T> = {}
) => {
  const userStore = useUserStore();
  const { token } = storeToRefs(userStore);

  const mergedOptions = {
    ...options,
    headers: {
      ...(options?.headers || {}),
      ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
    },
  };

  return useFetch<T>(url, mergedOptions);
};

/**
 * fetchWithAuth - wrapper that preserves typeof $fetch while injecting the Bearer token.
 */
export const fetchWithAuth = Object.assign(
  <T>(url: string, options: FetchOptions<T> = {}) => {
    const userStore = useUserStore();
    const { token } = storeToRefs(userStore);

    const mergedOptions = {
      ...options,
      headers: {
        ...(options?.headers || {}),
        ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
      },
    };

    return $fetch<T>(url, mergedOptions);
  },
  {
    raw: $fetch.raw,
    create: $fetch.create,
  }
) as typeof $fetch;
