import SwiftUI

// DevBar — dev-only floating swatch picker, bottom-right of the window.
//
// The ONLY project-specific parts are `swatches` and how the app reads
// `DevBarState.shared.value`. Everything else — pill geometry, hover
// expand/collapse, checkmark contrast — is boilerplate; leave it alone.
//
// Delete this file and its overlay call once a value wins.

/// Live design knob shared across the app. Flip `DevBar.enabled` to false to
/// hide the picker once a value is chosen; move the winner into the theme and
/// this whole file can be deleted.
@MainActor
@Observable
final class DevBarState {
    static let shared = DevBarState()

    /// When set, overrides the compiled-in value at render time so swatches
    /// preview live. `nil` = whatever the app already ships.
    var value: Color?

    // ===== THE ONLY PROJECT-SPECIFIC PART =====
    // Candidates should pull in different directions, not just deeper versions
    // of the current tone. Say what each one is trying, in a comment.
    let swatches: [(name: String, color: Color)] = [
        ("Paper", Color(red: 0.96, green: 0.94, blue: 0.90)),   // current compiled-in tone
        ("Bone",  Color(red: 0.98, green: 0.97, blue: 0.95)),   // lighter, cooler
        ("Mist",  Color(red: 0.94, green: 0.95, blue: 0.95)),   // cooler still
        ("Sand",  Color(red: 0.92, green: 0.89, blue: 0.83)),   // warmer, deeper
    ]
    // ==========================================
}

/// Whether the DevBar shows. Kept as a single toggle so it's trivial to hide.
extension DevBarState { static let enabled = true }

/// Floating bottom-right picker: idle it's a chevron plus one dot of the active
/// value; on hover it expands leftward into every swatch, checkmark on the
/// active one. Click to repaint live.
struct DevBar: View {
    /// The app's compiled-in value, shown when nothing is picked yet.
    var fallback: Color

    @State private var dev = DevBarState.shared
    @State private var hovered = false

    private let dot: CGFloat = 14
    private let gap: CGFloat = 6
    private let pad: CGFloat = 8
    private let chev: CGFloat = 9

    private var widthIdle: CGFloat { pad * 2 + chev + 4 + dot }
    private var widthOpen: CGFloat {
        let n = CGFloat(dev.swatches.count)
        return pad * 2 + n * dot + (n - 1) * gap
    }

    var body: some View {
        ZStack(alignment: .trailing) {
            HStack(spacing: 4) {
                Image(systemName: "chevron.left")
                    .font(.system(size: chev, weight: .bold))
                    .foregroundStyle(.secondary)
                circle(dev.value ?? fallback)
            }
            .opacity(hovered ? 0 : 1)

            HStack(spacing: gap) {
                ForEach(dev.swatches, id: \.name) { swatch($0) }
            }
            .opacity(hovered ? 1 : 0)
            .allowsHitTesting(hovered)          // idle: dots are invisible, don't let them eat clicks
        }
        .frame(width: hovered ? widthOpen : widthIdle, height: dot + pad, alignment: .trailing)
        .padding(.horizontal, pad)
        .padding(.vertical, 6)
        .background(
            Capsule().fill(Color(nsColor: .controlBackgroundColor))
                .overlay(Capsule().stroke(Color.black.opacity(0.08)))
        )
        .clipShape(Capsule())
        .onHover { h in
            withAnimation(.spring(duration: 0.25, bounce: 0.1)) { hovered = h }
        }
    }

    private func circle(_ color: Color) -> some View {
        Circle().fill(color)
            .frame(width: dot, height: dot)
            .overlay(Circle().stroke(Color.black.opacity(0.15)))
    }

    private func swatch(_ c: (name: String, color: Color)) -> some View {
        Button { dev.value = c.color } label: {
            circle(c.color)
                .overlay(
                    Image(systemName: "checkmark")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(c.color.isDark ? .white : .black)
                        .opacity(dev.value == c.color ? 1 : 0)
                )
        }
        .buttonStyle(.plain)
        .help(c.name)
    }
}

extension Color {
    /// True when the color is dark enough to need light glyphs on top of it.
    var isDark: Bool {
        guard let c = NSColor(self).usingColorSpace(.sRGB) else { return false }
        // 0.68 cutoff: mid-tone tracks still count as "dark" and take light
        // glyphs; only genuinely light tracks flip to dark ones.
        return (0.299 * c.redComponent + 0.587 * c.greenComponent + 0.114 * c.blueComponent) < 0.68
    }
}
