import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBloodbankStore } from "~/stores/bloodbank";

const mocks = vi.hoisted(() => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock("~/composables/useFetchWithAuth", () => ({
  fetchWithAuth: mocks.fetchWithAuth,
}));

function response(requestId: string) {
  return {
    success: true,
    data: [
      {
        _id: requestId,
        createdAt: "2026-08-28T12:00:00.000Z",
        updatedAt: "2026-08-28T12:00:00.000Z",
        availableSlotOptions: [],
        statusHistory: [],
      },
    ],
    pagination: { total: 1, page: 1, limit: 20, pages: 1 },
  };
}

function detailResponse(requestId: string) {
  return {
    success: true,
    data: {
      _id: requestId,
      createdAt: "2026-08-28T12:00:00.000Z",
      updatedAt: "2026-08-28T12:00:00.000Z",
      availableSlotOptions: [],
      statusHistory: [],
    },
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  mocks.fetchWithAuth.mockReset();
});

describe("loadCollectionRequests", () => {
  it("mantém a resposta nova quando a resposta antiga termina depois", async () => {
    let resolveFirst!: (value: unknown) => void;
    let resolveSecond!: (value: unknown) => void;
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondResponse = new Promise((resolve) => {
      resolveSecond = resolve;
    });
    mocks.fetchWithAuth
      .mockReturnValueOnce(firstResponse)
      .mockReturnValueOnce(secondResponse);

    const store = useBloodbankStore();
    const firstLoad = store.loadCollectionRequests(
      "blood-bank-a",
      { status: "pending" },
      1
    );
    const secondLoad = store.loadCollectionRequests(
      "blood-bank-a",
      { status: "accepted" },
      2
    );

    resolveFirst(response("old-request"));
    await firstLoad;

    expect(store.collectionRequests.data).toEqual([]);
    expect(store.isLoadingCollectionRequests).toBe(true);

    resolveSecond(response("new-request"));
    await secondLoad;

    expect(store.collectionRequests.data[0]?._id).toBe("new-request");
    expect(store.isLoadingCollectionRequests).toBe(false);
  });
});

describe("loadCollectionRequestById", () => {
  it("mantém a resposta nova quando a resposta antiga termina depois", async () => {
    let resolveFirst!: (value: unknown) => void;
    let resolveSecond!: (value: unknown) => void;
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondResponse = new Promise((resolve) => {
      resolveSecond = resolve;
    });
    mocks.fetchWithAuth
      .mockReturnValueOnce(firstResponse)
      .mockReturnValueOnce(secondResponse);

    const store = useBloodbankStore();
    store.currentCollectionRequest = detailResponse("previous-request").data;

    const firstLoad = store.loadCollectionRequestById(
      "old-request",
      "blood-bank-a"
    );
    const secondLoad = store.loadCollectionRequestById(
      "new-request",
      "blood-bank-a"
    );

    expect(store.currentCollectionRequest).toBeNull();

    resolveFirst(detailResponse("old-request"));
    await firstLoad;

    expect(store.currentCollectionRequest).toBeNull();
    expect(store.isLoadingCollectionRequests).toBe(true);

    resolveSecond(detailResponse("new-request"));
    await secondLoad;

    expect(store.currentCollectionRequest?._id).toBe("new-request");
    expect(store.isLoadingCollectionRequests).toBe(false);
  });
});
