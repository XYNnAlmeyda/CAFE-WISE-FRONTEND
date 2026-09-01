$files = Get-ChildItem -Path "c:\Users\Administrator\Music\houseblend-system-capstone\frontend\src" -Recurse -Include *.tsx, *.css

foreach ($f in $files) {
    $c = Get-Content $f.FullName -Raw
    
    # Replace white text colors with theme variable text colors
    $c = $c -replace "color:\s*'rgba\(255,\s*255,\s*255,\s*0\.2\)'", "color: 'var(--text-muted)'"
    $c = $c -replace "color:\s*'rgba\(255,\s*255,\s*255,\s*0\.3\)'", "color: 'var(--text-muted)'"
    $c = $c -replace "color:\s*'rgba\(255,\s*255,\s*255,\s*0\.4\)'", "color: 'var(--text-muted)'"
    $c = $c -replace "color:\s*'rgba\(255,\s*255,\s*255,\s*0\.5\)'", "color: 'var(--text-muted)'"
    $c = $c -replace "color:\s*'rgba\(255,\s*255,\s*255,\s*0\.6\)'", "color: 'var(--text-secondary)'"
    $c = $c -replace "color:\s*'rgba\(255,\s*255,\s*255,\s*0\.7\)'", "color: 'var(--text-secondary)'"
    $c = $c -replace "color:\s*'rgba\(255,\s*255,\s*255,\s*0\.8\)'", "color: 'var(--text-primary)'"
    $c = $c -replace "color:\s*'rgba\(255,\s*255,\s*255,\s*0\.85\)'", "color: 'var(--text-primary)'"
    $c = $c -replace "color:\s*'rgba\(255,\s*255,\s*255,\s*0\.9\)'", "color: 'var(--text-primary)'"
    
    # Table headers and cells with color: 'white'
    $c = $c -replace "fontWeight: 600, color: 'white'", "fontWeight: 600, color: 'var(--text-primary)'"
    $c = $c -replace "fontWeight: 700, color: 'white'", "fontWeight: 700, color: 'var(--text-primary)'"

    Set-Content $f.FullName $c
    Write-Host "Updated $($f.Name)"
}

Write-Host "Text visibility fix complete!"
