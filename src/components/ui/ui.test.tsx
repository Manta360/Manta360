import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, LoadingState } from "@/components/ui/state";

describe("UI primitives", () => {
  it("disables a loading button and exposes its busy state", () => {
    render(<Button loading>Guardar</Button>);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardar" })).toHaveAttribute("aria-busy", "true");
  });

  it("renders loading and empty states with accessible text", () => {
    render(<><LoadingState title="Cargando catálogo" /><EmptyState title="Sin propiedades" description="Aún no hay resultados." /></>);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando catálogo");
    expect(screen.getByText("Sin propiedades")).toBeInTheDocument();
  });

  it("closes a dialog with Escape and its close button", () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="Confirmar"><p>Contenido</p></Dialog>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar diálogo" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
