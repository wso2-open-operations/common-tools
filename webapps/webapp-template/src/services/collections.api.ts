import { createApi } from "@reduxjs/toolkit/query/react";

import { AppConfig } from "@config/config";

import { baseQueryWithReauth } from "./BaseQuery";

interface Collections {
  count: number;
  collections: Collection[];
}

export interface Collection {
  id: number;
  name: string;
  createdOn: string;
  createdBy: string;
  updatedOn: string;
  updatedBy: string;
}

export interface AddCollectionPayload {
  name: string;
}

export const collectionApi = createApi({
  reducerPath: "collectionApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Collections"],
  endpoints: (builder) => ({
    getCollections: builder.query<Collections, void>({
      query: () => AppConfig.serviceUrls.collections,
      providesTags: ["Collections"],
    }),
    addCollection: builder.mutation<void, AddCollectionPayload>({
      query: (payload) => ({
        url: AppConfig.serviceUrls.collections,
        method: "POST",
        body: payload,
        invalidatesTags: ["Collections"],
      }),
    }),
  }),
});

export const { useGetCollectionsQuery, useAddCollectionMutation } = collectionApi;
