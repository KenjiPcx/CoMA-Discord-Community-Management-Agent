import {
  Client,
  Collection,
  FetchMessagesOptions,
  Message,
  TextChannel,
} from "discord.js";
import { sendCardWithButtons } from "../bot/botActions";
import { getUnregisteredUsersFromIds } from "../db/users";

export const processNewMatchmakingMessages = async (client: Client) => {
  const channelId = process.env.DISCORD_MATCHMAKING_CHANNEL_ID;
  if (!channelId) {
    throw new Error("No channel ID provided");
  }
  const channel = await client.channels.fetch(channelId);

  if (!(channel instanceof TextChannel)) {
    console.error("Invalid channel");
    return;
  }

  const mins = process.env.DISCORD_MESSAGE_PROCESSING_INTERVAL_MIN;
  if (!mins) {
    throw new Error("No minutes provided");
  }
  const interval = new Date(Date.now() - parseInt(mins) * 60 * 1000);

  let messages = new Collection<string, Message>();
  let lastId: string | undefined;

  while (true) {
    const options: FetchMessagesOptions = { limit: 100 };
    if (lastId) options.before = lastId;

    const batch = await channel.messages.fetch(options);
    messages = messages.concat(batch);

    if (batch.size < 100 || batch.last()!.createdAt < interval) break;
    lastId = batch.last()!.id;
  }

  messages = messages.filter((msg) => msg.createdAt >= interval);

  const uniqueUserIds = new Set<string>();
  messages.forEach((message: Message) => {
    uniqueUserIds.add(message.author.id);
  });

  console.log(uniqueUserIds);

  try {
    const unregisteredUserIds = await getUnregisteredUsersFromIds(
      Array.from(uniqueUserIds)
    );

    // send dms to users
    for (const userId of unregisteredUserIds) {
      const user = await client.users.fetch(userId);
      await user.send(
        "Hey, I noticed you're looking in the team match up channel, would you be interested in trying out our matchmaking service? We'll try to pair you with people, but we first need to ask you some questions"
      );
      await sendCardWithButtons(
        client,
        user,
        "New Matchmaking Experience",
        "Would you like to try it out?",
        "matchmaking"
      );
      console.log(`Sent DM to user ${userId}`);
    }
  } catch (error) {
    console.error("Error fetching unregistered users:", error);
  }

  // const unregisteredUserIds = await getUnregisteredUsersFromIds(
  //   Array.from(uniqueUserIds)
  // );
  // for (const userId of unregisteredUserIds) {
  //   try {
  //     const user = await client.users.fetch(userId);
  //     await user.send(
  //       "Welcome! You've been noticed in our channel. Here's some important information..."
  //     );
  //     console.log(`Sent DM to user ${userId}`);
  //   } catch (error) {
  //     console.error(`Failed to send DM to user ${userId}:`, error);
  //   }
  // }
};
