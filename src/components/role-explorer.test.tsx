import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoleExplorer } from "@/components/role-explorer";

describe("RoleExplorer", () => {
  it("allows selecting each role journey and keeps its CTA functional", () => {
    render(<RoleExplorer />);

    expect(screen.getByRole("tab", { name: "Arrendatario" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Explora el catálogo público")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Municipio" }));
    expect(screen.getByRole("tab", { name: "Municipio" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Supervisa contratos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Comenzar →" })).toHaveAttribute("href", "/login");
  });
});
