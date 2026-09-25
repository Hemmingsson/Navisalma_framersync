import type { connect, ManagedCollection } from "framer-api";

type FramerClient = Awaited<ReturnType<typeof connect>>;

export async function findManagedCollection(
  framer: FramerClient,
  name: string,
): Promise<ManagedCollection | undefined> {
  const collections = await framer.getManagedCollections();
  return collections.find((collection) => collection.name === name);
}
