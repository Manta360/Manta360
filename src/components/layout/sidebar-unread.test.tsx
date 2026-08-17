import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/panel/arrendatario" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));

import { ChatUnreadProvider } from "@/components/layout/chat-unread-provider";
import { Sidebar } from "@/components/layout/sidebar";

afterEach(() => vi.unstubAllGlobals());

describe("sidebar unread badge", () => {
  it("muestra solo el conteo real y lo limpia cuando la conversación se lee", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ unreadCount: 2 }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatUnreadProvider role="ARRENDATARIO"><Sidebar role="ARRENDATARIO" /></ChatUnreadProvider>);

    await screen.findByText("2");
    expect(screen.getByText("Mensajes").parentElement).toHaveTextContent("Mensajes2");

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ unreadCount: 0 }) });
    window.dispatchEvent(new Event("manta360:chat-read"));
    await waitFor(() => expect(screen.queryByText("2")).not.toBeInTheDocument());
  });
});
